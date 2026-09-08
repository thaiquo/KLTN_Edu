package iuh.fit.contract_service.document;

public interface ContractArtifactStorage {
    StoredArtifact put(String objectKey, byte[] content, String contentType);
    byte[] get(String objectKey);
    void delete(String objectKey);

    record StoredArtifact(String objectKey, String contentType, long size) {}
}
