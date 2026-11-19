package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexResult;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexStatus;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexedChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeDocument;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeState;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class ChatKnowledgeIndexService {
    private static final Logger log = LoggerFactory.getLogger(ChatKnowledgeIndexService.class);

    private final ChatKnowledgeDocumentLoader loader;
    private final ChatKnowledgeVectorStore vectorStore;
    private final EmbeddingService embeddingService;
    private final ChatKnowledgeProperties properties;
    private final ReentrantLock syncLock = new ReentrantLock();

    private volatile KnowledgeState state = KnowledgeState.DEGRADED;
    private volatile Instant lastAttemptAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError = "Knowledge index has not completed its first synchronization.";
    private volatile int sourceDocumentCount;
    private volatile int sourceChunkCount;

    public ChatKnowledgeIndexService(
            ChatKnowledgeDocumentLoader loader,
            ChatKnowledgeVectorStore vectorStore,
            EmbeddingService embeddingService,
            ChatKnowledgeProperties properties
    ) {
        this.loader = loader;
        this.vectorStore = vectorStore;
        this.embeddingService = embeddingService;
        this.properties = properties;
    }

    /** Manual Admin refresh. The live collection is never dropped. */
    public IndexResult reindex() {
        if (!syncLock.tryLock()) {
            throw new KnowledgeSyncInProgressException();
        }
        try {
            return synchronizeWithRetry(true);
        } finally {
            syncLock.unlock();
        }
    }

    /** Startup synchronization and periodic recovery after Qdrant restarts or volume replacement. */
    public void recoverAndSynchronize() {
        if (!syncLock.tryLock()) {
            return;
        }
        try {
            IndexResult result = synchronizeWithRetry(false);
            if (result.state() == KnowledgeState.READY) {
                log.info("Chatbot knowledge is ready: {} documents, {} chunks, {} points.",
                        result.filesLoaded(), result.chunksCreated(), result.pointCount());
            } else {
                log.warn("Chatbot knowledge synchronization ended in state {}: {}",
                        result.state(), String.join("; ", result.errors()));
            }
        } finally {
            syncLock.unlock();
        }
    }

    public IndexStatus status() {
        boolean exists = false;
        long points = 0;
        int indexedDocuments = 0;
        try {
            exists = vectorStore.collectionExists();
            if (exists) {
                points = vectorStore.countPoints();
                indexedDocuments = vectorStore.countIndexedDocuments();
            }
        } catch (RuntimeException exception) {
            if (!syncLock.isLocked()) {
                state = KnowledgeState.FAILED;
                lastError = safeMessage(exception);
            }
        }
        return new IndexStatus(
                properties.collection(),
                syncLock.isLocked() ? KnowledgeState.INDEXING : state,
                exists,
                points,
                indexedDocuments,
                sourceDocumentCount,
                sourceChunkCount,
                lastAttemptAt,
                lastSuccessfulSyncAt,
                lastError,
                syncLock.isLocked()
        );
    }

    private IndexResult synchronizeWithRetry(boolean forceRefresh) {
        lastAttemptAt = Instant.now();
        state = KnowledgeState.INDEXING;
        RuntimeException lastException = null;
        for (int attempt = 1; attempt <= properties.retryAttempts(); attempt++) {
            try {
                return synchronizeOnce(forceRefresh);
            } catch (RuntimeException exception) {
                lastException = exception;
                lastError = safeMessage(exception);
                if (attempt < properties.retryAttempts()) {
                    sleepBackoff(attempt);
                }
            }
        }

        long points = safePointCount();
        state = points > 0 ? KnowledgeState.DEGRADED : KnowledgeState.FAILED;
        String error = lastException == null ? "Knowledge synchronization failed." : safeMessage(lastException);
        lastError = error;
        return new IndexResult(
                properties.collection(), sourceDocumentCount, sourceChunkCount,
                0, 0, 0, List.of(error), lastAttemptAt, points, state
        );
    }

    private IndexResult synchronizeOnce(boolean forceRefresh) {
        List<KnowledgeDocument> documents = loader.loadDocuments();
        List<KnowledgeChunk> chunks = new ArrayList<>();
        for (KnowledgeDocument document : documents) {
            chunks.addAll(loader.chunk(document));
        }
        sourceDocumentCount = documents.size();
        sourceChunkCount = chunks.size();
        if (chunks.isEmpty()) {
            throw new ChatKnowledgeException("No valid Markdown knowledge chunks were found.");
        }

        vectorStore.ensureCollection();
        Map<String, IndexedChunk> indexed = vectorStore.indexedChunks();
        Map<String, KnowledgeChunk> expected = new LinkedHashMap<>();
        for (KnowledgeChunk chunk : chunks) {
            expected.put(pointId(chunk), chunk);
        }

        List<String> errors = new ArrayList<>();
        int inserted = 0;
        int skipped = 0;
        for (Map.Entry<String, KnowledgeChunk> entry : expected.entrySet()) {
            String pointId = entry.getKey();
            KnowledgeChunk chunk = entry.getValue();
            IndexedChunk existing = indexed.get(pointId);
            if (!forceRefresh && isCurrent(existing, chunk)) {
                skipped++;
                continue;
            }
            try {
                EmbeddingVector vector = embeddingService.embed(chunk.content());
                vectorStore.upsert(pointId, vector, chunk, properties.documentVersion());
                inserted++;
            } catch (RuntimeException exception) {
                errors.add(chunk.sourceName() + "#" + chunk.section() + ": " + safeMessage(exception));
            }
        }

        int deleted = 0;
        if (errors.isEmpty()) {
            Set<String> stalePointIds = new LinkedHashSet<>(indexed.keySet());
            stalePointIds.removeAll(expected.keySet());
            vectorStore.deletePoints(stalePointIds);
            deleted = stalePointIds.size();
        }

        long pointCount = vectorStore.countPoints();
        Instant finishedAt = Instant.now();
        if (errors.isEmpty() && pointCount == expected.size()) {
            state = KnowledgeState.READY;
            lastSuccessfulSyncAt = finishedAt;
            lastError = null;
        } else {
            state = pointCount > 0 ? KnowledgeState.DEGRADED : KnowledgeState.FAILED;
            lastError = errors.isEmpty()
                    ? "Knowledge point count mismatch. Expected " + expected.size() + " but found " + pointCount + "."
                    : String.join("; ", errors);
        }

        return new IndexResult(
                properties.collection(), documents.size(), chunks.size(), inserted, skipped, deleted,
                List.copyOf(errors), finishedAt, pointCount, state
        );
    }

    private boolean isCurrent(IndexedChunk existing, KnowledgeChunk chunk) {
        return existing != null
                && existing.documentVersion() == properties.documentVersion()
                && existing.contentHash().equals(chunk.contentHash())
                && existing.documentId().equals(chunk.documentId());
    }

    String pointId(KnowledgeChunk chunk) {
        String seed = "chatbot:" + chunk.documentId() + ":" + chunk.chunkIndex();
        return UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8)).toString();
    }

    private long safePointCount() {
        try {
            return vectorStore.collectionExists() ? vectorStore.countPoints() : 0L;
        } catch (RuntimeException ignored) {
            return 0L;
        }
    }

    private void sleepBackoff(int attempt) {
        long multiplier = 1L << Math.min(attempt - 1, 4);
        long delay = Math.min(properties.retryInitialBackoffMs() * multiplier, 30_000L);
        try {
            Thread.sleep(delay);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ChatKnowledgeException("Knowledge synchronization was interrupted.", exception);
        }
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.replaceAll("(?i)(api-key|key|token|secret)=[^\\s]+", "$1=<redacted>");
    }

    public static final class KnowledgeSyncInProgressException extends RuntimeException {
        public KnowledgeSyncInProgressException() {
            super("Chatbot knowledge synchronization is already running.");
        }
    }
}
