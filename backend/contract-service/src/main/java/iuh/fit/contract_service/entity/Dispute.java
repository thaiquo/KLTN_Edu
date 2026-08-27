package iuh.fit.contract_service.entity;

import iuh.fit.contract_service.enums.DisputeStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "dispute")
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Dispute {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "settlement_id", nullable = false, unique = true)
    private SessionSettlement settlement;

    @Column(name = "type", nullable = false, length = 40)
    private String type;

    @Column(name = "complainant_id", nullable = false)
    private Long complainantId;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private DisputeStatus status;

    @Column(name = "tutor_response", columnDefinition = "TEXT")
    private String tutorResponse;

    @Column(name = "tutor_responded_at")
    private Instant tutorRespondedAt;

    @Column(name = "resolution", length = 20)
    private String resolution;

    @Column(name = "resolution_reason", columnDefinition = "TEXT")
    private String resolutionReason;

    @Column(name = "resolved_by_user_id")
    private Long resolvedByUserId;

    @Column(name = "resolved_by_email")
    private String resolvedByEmail;

    @Column(name = "resolved_by_role", length = 20)
    private String resolvedByRole;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "open_tx_hash", length = 66)
    private String openTxHash;

    @Column(name = "resolve_tx_hash", length = 66)
    private String resolveTxHash;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void markOpen(String txHash) {
        this.status = DisputeStatus.OPEN;
        if (txHash != null) {
            this.openTxHash = txHash;
        }
    }

    public void markResolutionPending() {
        this.status = DisputeStatus.RESOLUTION_PENDING;
    }

    public void markResolved(
            boolean approved,
            String resolutionReason,
            Long resolvedByUserId,
            String resolvedByEmail,
            String resolvedByRole,
            String txHash) {
        this.status = approved ? DisputeStatus.APPROVED : DisputeStatus.REJECTED;
        this.resolution = approved ? "APPROVED" : "REJECTED";
        this.resolutionReason = resolutionReason;
        this.resolvedByUserId = resolvedByUserId;
        this.resolvedByEmail = resolvedByEmail;
        this.resolvedByRole = resolvedByRole;
        this.resolvedAt = Instant.now();
        if (txHash != null) {
            this.resolveTxHash = txHash;
        }
    }
}
