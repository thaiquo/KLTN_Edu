package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexedChunk;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface ChatKnowledgeVectorStore {
    void ensureCollection();

    boolean collectionExists();

    long countPoints();

    int countIndexedDocuments();

    Map<String, IndexedChunk> indexedChunks();

    void upsert(String pointId, EmbeddingVector vector, KnowledgeChunk chunk, int documentVersion);

    void deletePoints(Collection<String> pointIds);

    List<KnowledgeSearchHit> search(EmbeddingVector queryVector, List<String> roleVisibility, int limit, double minScore);
}
