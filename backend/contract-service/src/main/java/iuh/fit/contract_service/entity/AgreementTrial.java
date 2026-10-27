package iuh.fit.contract_service.entity;

import iuh.fit.contract_service.enums.TrialDecisionSource;
import iuh.fit.contract_service.enums.TrialStatus;
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
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "agreement_trial")
@Getter
@Setter
public class AgreementTrial {
    @Id
    @Column(name = "agreement_id")
    private UUID agreementId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agreement_id", insertable = false, updatable = false)
    private ContractAgreement agreement;

    @Column(name = "policy_version", nullable = false)
    private Short policyVersion;

    @Column(name = "trial_session_sequence", nullable = false)
    private Integer trialSessionSequence;

    @Column(name = "next_session_sequence", nullable = false)
    private Integer nextSessionSequence;

    @Column(name = "trial_session_start_at", nullable = false)
    private OffsetDateTime trialSessionStartAt;

    @Column(name = "trial_deadline", nullable = false)
    private OffsetDateTime trialDeadline;

    @Column(name = "schedule_fingerprint", nullable = false, length = 64)
    private String scheduleFingerprint;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TrialStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision_source", length = 30)
    private TrialDecisionSource decisionSource;

    @Column(name = "decision_at")
    private OffsetDateTime decisionAt;

    @Column(name = "opt_out_received_at")
    private OffsetDateTime optOutReceivedAt;

    @Column(name = "termination_case_id")
    private UUID terminationCaseId;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
