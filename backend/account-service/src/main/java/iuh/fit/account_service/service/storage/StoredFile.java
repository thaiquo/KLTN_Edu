package iuh.fit.account_service.service.storage;

public class StoredFile {

    private final String fileKey;
    private final String contentType;
    private final long fileSize;

    public StoredFile(String fileKey, String contentType, long fileSize) {
        this.fileKey = fileKey;
        this.contentType = contentType;
        this.fileSize = fileSize;
    }

    public String getFileKey() {
        return fileKey;
    }

    public String getContentType() {
        return contentType;
    }

    public long getFileSize() {
        return fileSize;
    }
}
