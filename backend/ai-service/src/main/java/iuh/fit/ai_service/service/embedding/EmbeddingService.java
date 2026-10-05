package iuh.fit.ai_service.service.embedding;

public interface EmbeddingService {
    EmbeddingVector embed(String text);
}
