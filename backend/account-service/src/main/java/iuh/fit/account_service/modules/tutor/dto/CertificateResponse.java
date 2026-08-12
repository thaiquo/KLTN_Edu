package iuh.fit.account_service.modules.tutor.dto;

import iuh.fit.account_service.modules.tutor.enums.CertificateVerificationStatus;

import java.time.LocalDate;
import java.util.UUID;

public record CertificateResponse(
    UUID id,
    String name,
    String issuer,
    LocalDate issueDate,
    LocalDate expiryDate,
    String fileKey,
    String fileUrl,
    String originalFileName,
    String contentType,
    long fileSize,
    String downloadPath,
    CertificateVerificationStatus verificationStatus
) {
}
