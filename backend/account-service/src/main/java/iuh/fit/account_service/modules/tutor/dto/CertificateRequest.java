package iuh.fit.account_service.modules.tutor.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CertificateRequest(
    @NotBlank @Size(max = 255) String name,
    @NotBlank @Size(max = 255) String issuer,
    @NotNull LocalDate issueDate,
    LocalDate expiryDate,
    @NotBlank @Size(max = 1024) String fileKey,
    @NotBlank @Size(max = 255) String originalFileName,
    @NotBlank @Size(max = 100) String contentType,
    @NotNull Long fileSize
) {
}
