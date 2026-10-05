package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.service.embedding.EmbeddingVector;

import java.util.List;

public interface SemanticVectorStore {
    void initializeCollection();

    SemanticPayload getPayload(String pointId);

    void upsert(String pointId, EmbeddingVector vector, SemanticPayload payload);

    void delete(String pointId);

    List<SemanticSearchHit> search(EmbeddingVector queryVector, SemanticSearchFilter filter, int limit);
}
