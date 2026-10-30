package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.service.embedding.EmbeddingVector;

import java.util.List;

import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.VectorStoreHealth;

public interface ClassSemanticVectorStore {
    void initializeCollection();

    ClassSemanticPayload getPayload(String pointId);

    void upsert(String pointId, EmbeddingVector vector, ClassSemanticPayload payload);

    void delete(String pointId);

    List<ClassSemanticStoredPoint> listPayloads();

    List<ClassSemanticSearchHit> search(EmbeddingVector queryVector, ClassSemanticSearchFilter filter, int limit);

    default VectorStoreHealth health() {
        return VectorStoreHealth.unavailable(null);
    }
}
