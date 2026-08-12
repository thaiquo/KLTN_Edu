package iuh.fit.account_service.infrastructure.storage;

public record StoredObject(String key, String url, String originalFileName, String contentType, long size) {
}
