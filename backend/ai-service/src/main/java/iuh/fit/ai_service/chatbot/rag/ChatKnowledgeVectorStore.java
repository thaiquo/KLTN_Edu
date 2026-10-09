package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;

import java.util.List;

public interface ChatKnowledgeVectorStore {
    void recreateCollection();

    boolean collectionExists();

    long countPoints();

    int countIndexedDocuments();

    void upsert(String pointId, EmbeddingVector vector, KnowledgeChunk chunk, int documentVersion);

    List<KnowledgeSearchHit> search(EmbeddingVector queryVector, List<String> roleVisibility, int limit, double minScore);
}
