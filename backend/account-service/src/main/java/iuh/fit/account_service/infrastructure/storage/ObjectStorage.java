package iuh.fit.account_service.infrastructure.storage;

public interface ObjectStorage {
    void put(String key, byte[] content, String contentType);
    StoredContent get(String key);
    String url(String key);
}
