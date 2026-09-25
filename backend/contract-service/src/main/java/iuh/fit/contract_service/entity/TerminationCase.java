package iuh.fit.contract_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "termination_case")
@Getter @Setter
public class TerminationCase {
    @Id private UUID id;
    private UUID anchorAgreementId;
    private Long classroomId;
    private boolean wholeClass;
    @Column(columnDefinition = "TEXT") private String reason;
    private String requestedBy;
    private String status;
    private String detectionKey;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    @Column(columnDefinition = "TEXT") private String auditJson;
    @Column(columnDefinition = "TEXT") private String lastError;
    private String signerWallet;
    @Column(columnDefinition = "TEXT") private String signature;
    private Long requestedAtTimestamp;
    @Version private Long version;
}
