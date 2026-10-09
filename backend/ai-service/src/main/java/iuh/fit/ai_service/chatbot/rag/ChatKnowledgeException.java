package iuh.fit.ai_service.chatbot.rag;

public class ChatKnowledgeException extends RuntimeException {
    public ChatKnowledgeException(String message) {
        super(message);
    }

    public ChatKnowledgeException(String message, Throwable cause) {
        super(message, cause);
    }
}
