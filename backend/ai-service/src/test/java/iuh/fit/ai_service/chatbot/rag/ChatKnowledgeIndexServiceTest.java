package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexedChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeDocument;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeState;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import org.junit.jupiter.api.Test;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChatKnowledgeIndexServiceTest {
    private final ChatKnowledgeDocumentLoader loader = mock(ChatKnowledgeDocumentLoader.class);
    private final EmbeddingService embeddingService = mock(EmbeddingService.class);
    private final ChatKnowledgeProperties properties = new ChatKnowledgeProperties(
            "docs/chatbot-knowledge", "educonnect_chatbot_knowledge_v1", 3, 4, 0.35, 1
    );
    private final InMemoryVectorStore vectorStore = new InMemoryVectorStore();
    private final ChatKnowledgeIndexService service = new ChatKnowledgeIndexService(
            loader, vectorStore, embeddingService, properties
    );

    @Test
    void createsMissingCollectionAndSecondSyncIsIdempotent() {
        KnowledgeDocument document = document("overview");
        List<KnowledgeChunk> chunks = List.of(chunk("overview", 0, "hash-a"), chunk("overview", 1, "hash-b"));
        stub(document, chunks);

        service.recoverAndSynchronize();
        var first = service.status();
        service.recoverAndSynchronize();
        var second = service.status();

        assertThat(first.state()).isEqualTo(KnowledgeState.READY);
        assertThat(first.pointCount()).isEqualTo(2);
        assertThat(second.pointCount()).isEqualTo(2);
        assertThat(vectorStore.upsertCalls).isEqualTo(2);
        assertThat(vectorStore.ensureCalls).isEqualTo(2);
    }

    @Test
    void updatesChangedChunkAndDeletesStaleChunkOnlyAfterSuccessfulUpserts() {
        KnowledgeDocument document = document("overview");
        KnowledgeChunk first = chunk("overview", 0, "hash-a");
        KnowledgeChunk removed = chunk("overview", 1, "hash-b");
        stub(document, List.of(first, removed));
        service.recoverAndSynchronize();

        KnowledgeChunk changed = chunk("overview", 0, "hash-changed");
        when(loader.chunk(document)).thenReturn(List.of(changed));
        service.recoverAndSynchronize();

        assertThat(service.status().state()).isEqualTo(KnowledgeState.READY);
        assertThat(vectorStore.points).hasSize(1);
        assertThat(vectorStore.upsertCalls).isEqualTo(3);
        assertThat(vectorStore.deletedPoints).isEqualTo(1);
    }

    @Test
    void recoversWhenCollectionDisappearsWhileServiceKeepsRunning() {
        KnowledgeDocument document = document("overview");
        stub(document, List.of(chunk("overview", 0, "hash-a")));
        service.recoverAndSynchronize();

        vectorStore.resetCollection();
        service.recoverAndSynchronize();

        assertThat(service.status().state()).isEqualTo(KnowledgeState.READY);
        assertThat(vectorStore.points).hasSize(1);
        assertThat(vectorStore.upsertCalls).isEqualTo(2);
    }

    @Test
    void failedReplacementDoesNotDeletePreviouslyServingPoints() {
        KnowledgeDocument document = document("overview");
        KnowledgeChunk old = chunk("overview", 0, "hash-a");
        KnowledgeChunk stale = chunk("overview", 1, "hash-b");
        stub(document, List.of(old, stale));
        service.recoverAndSynchronize();

        KnowledgeChunk changed = chunk("overview", 0, "hash-changed");
        when(loader.chunk(document)).thenReturn(List.of(changed));
        when(embeddingService.embed(changed.content())).thenThrow(new RuntimeException("embedding unavailable"));
        service.recoverAndSynchronize();

        assertThat(service.status().state()).isEqualTo(KnowledgeState.DEGRADED);
        assertThat(vectorStore.points).hasSize(2);
        assertThat(vectorStore.deletedPoints).isZero();
    }

    private void stub(KnowledgeDocument document, List<KnowledgeChunk> chunks) {
        when(loader.loadDocuments()).thenReturn(List.of(document));
        when(loader.chunk(document)).thenReturn(chunks);
        for (KnowledgeChunk chunk : chunks) {
            when(embeddingService.embed(chunk.content())).thenReturn(new EmbeddingVector(List.of(0.1f, 0.2f, 0.3f)));
        }
    }

    private KnowledgeDocument document(String id) {
        return new KnowledgeDocument(id, "Tổng quan", "overview", id + ".md", id + ".md", "content");
    }

    private KnowledgeChunk chunk(String documentId, int index, String hash) {
        return new KnowledgeChunk(
                documentId, "Tổng quan", "Mục " + index, "overview", documentId + ".md",
                index, "Nội dung " + hash, hash, List.of("PUBLIC", "GUEST")
        );
    }

    private static final class InMemoryVectorStore implements ChatKnowledgeVectorStore {
        private final Map<String, StoredPoint> points = new LinkedHashMap<>();
        private boolean collectionExists;
        private int upsertCalls;
        private int ensureCalls;
        private int deletedPoints;

        @Override
        public void ensureCollection() {
            ensureCalls++;
            collectionExists = true;
        }

        @Override
        public boolean collectionExists() {
            return collectionExists;
        }

        @Override
        public long countPoints() {
            return collectionExists ? points.size() : 0;
        }

        @Override
        public int countIndexedDocuments() {
            return (int) points.values().stream().map(point -> point.indexed.documentId()).distinct().count();
        }

        @Override
        public Map<String, IndexedChunk> indexedChunks() {
            Map<String, IndexedChunk> indexed = new LinkedHashMap<>();
            points.forEach((id, point) -> indexed.put(id, point.indexed));
            return indexed;
        }

        @Override
        public void upsert(String pointId, EmbeddingVector vector, KnowledgeChunk chunk, int documentVersion) {
            upsertCalls++;
            points.put(pointId, new StoredPoint(new IndexedChunk(
                    pointId, chunk.documentId(), chunk.contentHash(), documentVersion
            ), chunk));
        }

        @Override
        public void deletePoints(Collection<String> pointIds) {
            for (String pointId : pointIds) {
                if (points.remove(pointId) != null) {
                    deletedPoints++;
                }
            }
        }

        @Override
        public List<KnowledgeSearchHit> search(
                EmbeddingVector queryVector, List<String> roleVisibility, int limit, double minScore
        ) {
            return List.of();
        }

        private void resetCollection() {
            collectionExists = false;
            points.clear();
        }

        private record StoredPoint(IndexedChunk indexed, KnowledgeChunk chunk) {
        }
    }
}
