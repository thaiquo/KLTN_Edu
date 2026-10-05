package iuh.fit.notification_service.service.storage;

public class ChatAttachmentStorageException extends RuntimeException {
    public ChatAttachmentStorageException(String message) {
        super(message);
    }

    public ChatAttachmentStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
