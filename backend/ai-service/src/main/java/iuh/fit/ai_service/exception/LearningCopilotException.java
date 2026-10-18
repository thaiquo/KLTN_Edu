package iuh.fit.ai_service.exception;

public class LearningCopilotException extends RuntimeException {
    private final Reason reason;

    public LearningCopilotException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }

    public enum Reason {
        UNAUTHORIZED,
        FORBIDDEN,
        BAD_REQUEST,
        DOWNSTREAM_UNAVAILABLE
    }
}
