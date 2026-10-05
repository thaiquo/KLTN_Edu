package iuh.fit.notification_service.service.storage;

public interface ChatAttachmentStorage {
    StoredChatAttachment put(String objectKey, byte[] content, String contentType);

    String createPresignedGetUrl(String objectKey);

    void delete(String objectKey);

    record StoredChatAttachment(String objectKey, String contentType, long size) {}
}
