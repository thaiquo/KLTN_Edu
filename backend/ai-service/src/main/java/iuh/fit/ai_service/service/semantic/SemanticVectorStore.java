package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.service.embedding.EmbeddingVector;

import java.util.List;

import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.VectorStoreHealth;

public interface SemanticVectorStore {
    void initializeCollection();

    SemanticPayload getPayload(String pointId);

    void upsert(String pointId, EmbeddingVector vector, SemanticPayload payload);

    void delete(String pointId);

    List<SemanticSearchHit> search(EmbeddingVector queryVector, SemanticSearchFilter filter, int limit);

    default VectorStoreHealth health() {
        return VectorStoreHealth.unavailable(null);
    }
}
