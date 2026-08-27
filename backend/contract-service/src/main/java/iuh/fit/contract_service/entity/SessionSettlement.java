package iuh.fit.contract_service.entity;

import iuh.fit.contract_service.enums.SettlementOutcome;
import iuh.fit.contract_service.enums.SettlementStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Entity
@Table(name = "session_settlement")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SessionSettlement {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agreement_id", nullable = false)
    private ContractAgreement agreement;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "onchain_session_id", nullable = false, length = 66)
    private String onchainSessionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private SettlementOutcome outcome;

    @Column(nullable = false, precision = 78, scale = 0)
    private BigInteger amount;

    @Column(name = "dispute_deadline")
    private OffsetDateTime disputeDeadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private SettlementStatus status;

    @Column(name = "propose_tx_hash", length = 66)
    private String proposeTxHash;

    @Column(name = "finalize_tx_hash", length = 66)
    private String finalizeTxHash;

    @Column(name = "proposal_evidence_hash", length = 66)
    private String proposalEvidenceHash;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public static SessionSettlement create(
            ContractAgreement agreement,
            Long sessionId,
            String onchainSessionId,
            SettlementOutcome outcome,
            BigInteger amount,
            String proposalEvidenceHash) {
        SessionSettlement settlement = new SessionSettlement();
        settlement.id = UUID.randomUUID();
        settlement.agreement = agreement;
        settlement.sessionId = sessionId;
        settlement.onchainSessionId = onchainSessionId;
        settlement.outcome = outcome;
        settlement.amount = amount;
        settlement.proposalEvidenceHash = proposalEvidenceHash;
        settlement.status = SettlementStatus.PREPARING;
        settlement.createdAt = OffsetDateTime.now();
        settlement.updatedAt = settlement.createdAt;
        return settlement;
    }

    public void markProposePending() {
        this.status = SettlementStatus.PROPOSE_PENDING;
        this.updatedAt = OffsetDateTime.now();
    }

    public void markProposed(OffsetDateTime disputeDeadline, String proposeTxHash) {
        this.status = SettlementStatus.PROPOSED;
        this.disputeDeadline = disputeDeadline;
        if (proposeTxHash != null) {
            this.proposeTxHash = proposeTxHash;
        }
        this.updatedAt = OffsetDateTime.now();
    }

    public void markFinalizePending() {
        this.status = SettlementStatus.FINALIZE_PENDING;
        this.updatedAt = OffsetDateTime.now();
    }

    public void markSettled(String finalizeTxHash) {
        this.status = SettlementStatus.SETTLED;
        if (finalizeTxHash != null) {
            this.finalizeTxHash = finalizeTxHash;
        }
        this.updatedAt = OffsetDateTime.now();
    }

    public void markRefunded(String finalizeTxHash) {
        this.status = SettlementStatus.REFUNDED;
        if (finalizeTxHash != null) {
            this.finalizeTxHash = finalizeTxHash;
        }
        this.updatedAt = OffsetDateTime.now();
    }

    public void markDisputed() {
        this.status = SettlementStatus.DISPUTED;
        this.updatedAt = OffsetDateTime.now();
    }
}
