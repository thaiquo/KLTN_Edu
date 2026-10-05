package iuh.fit.ai_service.service.semantic;

public class SemanticVectorStoreException extends RuntimeException {
    public SemanticVectorStoreException(String message) {
        super(message);
    }

    public SemanticVectorStoreException(String message, Throwable cause) {
        super(message, cause);
    }
}
