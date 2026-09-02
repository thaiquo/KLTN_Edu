package iuh.fit.contract_service.entity;

import iuh.fit.contract_service.enums.ContractDocumentArtifactStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "contract_document_artifact",
        uniqueConstraints = @UniqueConstraint(name = "uq_contract_document_artifact_version",
                columnNames = {"agreement_id", "contract_version"}))
public class ContractDocumentArtifact {
    @Id
    private UUID id;

    @Column(name = "agreement_id", nullable = false)
    private UUID agreementId;

    @Column(name = "contract_version", nullable = false)
    private Integer contractVersion;

    @Column(name = "template_version", nullable = false, length = 128)
    private String templateVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ContractDocumentArtifactStatus status;

    @Column(name = "docx_object_key", length = 512)
    private String docxObjectKey;

    @Column(name = "pdf_object_key", length = 512)
    private String pdfObjectKey;

    @Column(name = "docx_sha256", length = 64)
    private String docxSha256;

    @Column(name = "pdf_sha256", length = 64)
    private String pdfSha256;

    @Column(name = "docx_size")
    private Long docxSize;

    @Column(name = "pdf_size")
    private Long pdfSize;

    @Column(name = "failure_code", length = 64)
    private String failureCode;

    @Column(name = "failure_message", length = 1000)
    private String failureMessage;

    @Column(name = "generated_at")
    private OffsetDateTime generatedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;
}
