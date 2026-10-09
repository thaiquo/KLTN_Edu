package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexResult;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexStatus;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeDocument;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ChatKnowledgeIndexService {
    private final ChatKnowledgeDocumentLoader loader;
    private final ChatKnowledgeVectorStore vectorStore;
    private final EmbeddingService embeddingService;
    private final ChatKnowledgeProperties properties;

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

    public IndexResult reindex() {
        Instant startedAt = Instant.now();
        List<String> errors = new ArrayList<>();
        List<KnowledgeDocument> documents = loader.loadDocuments();
        List<KnowledgeChunk> chunks = new ArrayList<>();
        for (KnowledgeDocument document : documents) {
            chunks.addAll(loader.chunk(document));
        }

        vectorStore.recreateCollection();
        int inserted = 0;
        for (KnowledgeChunk chunk : chunks) {
            try {
                EmbeddingVector vector = embeddingService.embed(chunk.content());
                vectorStore.upsert(pointId(chunk), vector, chunk, properties.documentVersion());
                inserted++;
            } catch (RuntimeException exception) {
                errors.add(chunk.sourceName() + "#" + chunk.section() + ": " + safeMessage(exception));
            }
        }

        return new IndexResult(
                properties.collection(),
                documents.size(),
                chunks.size(),
                inserted,
                errors,
                startedAt,
                vectorStore.countPoints()
        );
    }

    public IndexStatus status() {
        boolean exists = vectorStore.collectionExists();
        return new IndexStatus(
                properties.collection(),
                exists,
                exists ? vectorStore.countPoints() : 0L,
                exists ? vectorStore.countIndexedDocuments() : 0
        );
    }

    String pointId(KnowledgeChunk chunk) {
        String seed = "chatbot:" + chunk.documentId() + ":" + chunk.chunkIndex();
        return UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8)).toString();
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.replaceAll("(?i)(api-key|key|token|secret)=[^\\s]+", "$1=<redacted>");
    }
}
