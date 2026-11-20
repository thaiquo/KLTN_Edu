package iuh.fit.ai_service.chatbot.rag;

import java.time.Instant;
import java.util.List;

public final class ChatKnowledgeModels {
    private ChatKnowledgeModels() {
    }

    public record KnowledgeDocument(
            String documentId,
            String title,
            String category,
            String sourceName,
            String sourcePath,
            String content
    ) {
    }

    public record KnowledgeChunk(
            String documentId,
            String title,
            String section,
            String category,
            String sourceName,
            int chunkIndex,
            String content,
            String contentHash,
            List<String> roleVisibility
    ) {
    }

    public record KnowledgeSearchHit(
            String pointId,
            String documentId,
            String title,
            String section,
            String category,
            String content,
            double score
    ) {
    }

    public record IndexedChunk(
            String pointId,
            String documentId,
            String contentHash,
            int documentVersion
    ) {
    }

    public enum KnowledgeState {
        READY,
        INDEXING,
        DEGRADED,
        FAILED
    }

    public record IndexResult(
            String collection,
            int filesLoaded,
            int chunksCreated,
            int pointsInserted,
            int pointsSkipped,
            int pointsDeleted,
            List<String> errors,
            Instant indexedAt,
            long pointCount,
            KnowledgeState state
    ) {
    }

    public record IndexStatus(
            String collection,
            KnowledgeState state,
            boolean collectionExists,
            long pointCount,
            int indexedDocumentCount,
            int sourceDocumentCount,
            int sourceChunkCount,
            Instant lastAttemptAt,
            Instant lastSuccessfulSyncAt,
            String lastError,
            boolean syncInProgress
    ) {
    }
}
