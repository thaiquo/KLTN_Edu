package iuh.fit.learning_service.service.storage;

public interface FileStorageService {

    StoredFile store(String fileKey, byte[] content, String contentType);

    String createPresignedGetUrl(String fileKey);

    byte[] getBytes(String fileKey);

    void delete(String fileKey);
}
