package iuh.fit.account_service.modules.tutor.dto;

public record CertificateUploadResponse(
    String fileKey,
    String fileUrl,
    String originalFileName,
    String contentType,
    long fileSize
) {
}
