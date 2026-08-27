package iuh.fit.contract_service.entity;

import iuh.fit.contract_service.domain.ContractAgreementStateMachine;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Entity
@Table(name = "contract_agreement")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ContractAgreement {
    @Id
    private UUID id;

    @Column(name = "onchain_agreement_id", length = 66)
    private String onchainAgreementId;

    @Column(name = "classroom_id", nullable = false)
    private Long classroomId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "tutor_id", nullable = false)
    private Long tutorId;

    @Column(name = "classroom_reviewer_email")
    private String classroomReviewerEmail;

    @Column(name = "student_wallet", nullable = false, length = 42)
    private String studentWallet;

    @Column(name = "tutor_wallet", nullable = false, length = 42)
    private String tutorWallet;

    @Column(name = "platform_wallet", nullable = false, length = 42)
    private String platformWallet;

    @Column(name = "chain_id")
    private Long chainId;

    @Column(name = "escrow_contract_address", length = 42)
    private String escrowContractAddress;

    @Column(name = "token_address", length = 42)
    private String tokenAddress;

    @Column(name = "token_symbol", nullable = false, length = 20)
    private String tokenSymbol;

    @Column(name = "token_decimals", nullable = false)
    private Short tokenDecimals;

    @Column(name = "terms_json", nullable = false, columnDefinition = "TEXT")
    private String termsJson;

    @Column(name = "terms_hash", nullable = false, length = 66)
    private String termsHash;

    @Column(name = "contract_version", nullable = false)
    private Integer contractVersion;

    @Column(name = "total_price_vnd", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalPriceVnd;

    @Column(name = "vnd_per_usdc", nullable = false, precision = 19, scale = 6)
    private BigDecimal vndPerUsdc;

    @Column(name = "total_amount_usdc_units", nullable = false, precision = 78, scale = 0)
    private BigInteger totalAmountUsdcUnits;

    @Column(name = "price_per_session_usdc_units", nullable = false, precision = 78, scale = 0)
    private BigInteger pricePerSessionUsdcUnits;

    @Column(name = "total_sessions", nullable = false)
    private Integer totalSessions;

    @Column(name = "payment_deadline")
    private OffsetDateTime paymentDeadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ContractAgreementStatus status;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public void transitionTo(ContractAgreementStatus target) {
        ContractAgreementStateMachine.requireTransition(status, target);
        status = target;
        updatedAt = OffsetDateTime.now();
    }

    public void markWaitingPayment(OffsetDateTime deadline) {
        transitionTo(ContractAgreementStatus.WAITING_PAYMENT);
        this.paymentDeadline = deadline;
    }

    public void markPaymentConfirming() {
        transitionTo(ContractAgreementStatus.PAYMENT_CONFIRMING);
    }

    public void markActive() {
        if (status == ContractAgreementStatus.WAITING_PAYMENT) {
            transitionTo(ContractAgreementStatus.PAYMENT_CONFIRMING);
        }
        transitionTo(ContractAgreementStatus.ACTIVE);
    }

    public void markCompleted() {
        transitionTo(ContractAgreementStatus.COMPLETED);
    }
}
