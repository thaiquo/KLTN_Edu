package iuh.fit.contract_service.api.dto;

import iuh.fit.contract_service.entity.ContractDocumentArtifact;

import java.time.OffsetDateTime;

public record ContractDocumentArtifactDto(
        String agreementId,
        Integer contractVersion,
        String templateVersion,
        String status,
        boolean docxAvailable,
        boolean pdfAvailable,
        String pdfSha256,
        Long pdfSize,
        OffsetDateTime generatedAt,
        String failureCode,
        String failureMessage
) {
    public static ContractDocumentArtifactDto from(ContractDocumentArtifact value) {
        return new ContractDocumentArtifactDto(
                value.getAgreementId().toString(), value.getContractVersion(), value.getTemplateVersion(),
                value.getStatus().name(),
                value.getDocxObjectKey() != null && value.getDocxSize() != null && value.getDocxSize() > 0,
                value.getPdfObjectKey() != null && value.getPdfSize() != null && value.getPdfSize() > 0,
                value.getPdfSha256(), value.getPdfSize(), value.getGeneratedAt(),
                value.getFailureCode(), value.getFailureMessage());
    }
}
