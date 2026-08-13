package iuh.fit.account_service.service.storage;

public interface FileStorageService {

    StoredFile store(String fileKey, byte[] content, String contentType);

    String createPresignedGetUrl(String fileKey);

    void delete(String fileKey);
}
