package iuh.fit.ai_service.chatbot.service.private_tools;

public class PrivateToolException extends RuntimeException {
    private final Reason reason;

    public PrivateToolException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }

    public enum Reason {
        UNAUTHORIZED,
        FORBIDDEN,
        DOWNSTREAM_UNAVAILABLE
    }
}
