package iuh.fit.contract_service.entity;

import iuh.fit.contract_service.domain.EscrowPaymentStateMachine;
import iuh.fit.contract_service.enums.EscrowPaymentStatus;
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
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Entity
@Table(name = "escrow_payment")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EscrowPayment {
    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agreement_id", nullable = false, unique = true)
    private ContractAgreement agreement;

    @Column(name = "chain_id", nullable = false)
    private Long chainId;

    @Column(name = "token_address", nullable = false, length = 42)
    private String tokenAddress;

    @Column(name = "escrow_contract_address", nullable = false, length = 42)
    private String escrowContractAddress;

    @Column(name = "expected_amount", nullable = false, precision = 78, scale = 0)
    private BigInteger expectedAmount;

    @Column(name = "approve_tx_hash", length = 66)
    private String approveTxHash;

    @Column(name = "fund_tx_hash", length = 66)
    private String fundTxHash;

    @Column(name = "confirmed_block_number")
    private Long confirmedBlockNumber;

    @Column(name = "confirmed_block_hash", length = 66)
    private String confirmedBlockHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private EscrowPaymentStatus status;

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public static EscrowPayment create(ContractAgreement agreement) {
        EscrowPayment payment = new EscrowPayment();
        payment.id = UUID.randomUUID();
        payment.agreement = agreement;
        payment.chainId = agreement.getChainId();
        payment.tokenAddress = agreement.getTokenAddress();
        payment.escrowContractAddress = agreement.getEscrowContractAddress();
        payment.expectedAmount = agreement.getTotalAmountUsdcUnits();
        payment.status = EscrowPaymentStatus.NOT_STARTED;
        payment.createdAt = OffsetDateTime.now();
        payment.updatedAt = payment.createdAt;
        return payment;
    }

    public void transitionTo(EscrowPaymentStatus target) {
        EscrowPaymentStateMachine.requireTransition(status, target);
        status = target;
        updatedAt = OffsetDateTime.now();
    }

    public void recordConfirming(String fundTxHash) {
        if (status == EscrowPaymentStatus.NOT_STARTED) {
            transitionTo(EscrowPaymentStatus.DEPOSIT_PENDING);
        }
        if (status == EscrowPaymentStatus.APPROVAL_PENDING || status == EscrowPaymentStatus.DEPOSIT_PENDING) {
            transitionTo(EscrowPaymentStatus.CONFIRMING);
        }
        this.fundTxHash = fundTxHash;
    }

    public void markLocked(String fundTxHash, Long blockNumber, String blockHash) {
        if (status == EscrowPaymentStatus.NOT_STARTED) {
            transitionTo(EscrowPaymentStatus.DEPOSIT_PENDING);
        }
        if (status == EscrowPaymentStatus.APPROVAL_PENDING || status == EscrowPaymentStatus.DEPOSIT_PENDING) {
            transitionTo(EscrowPaymentStatus.CONFIRMING);
        }
        if (status == EscrowPaymentStatus.CONFIRMING) {
            transitionTo(EscrowPaymentStatus.LOCKED);
        }
        if (fundTxHash != null) {
            this.fundTxHash = fundTxHash;
        }
        this.confirmedBlockNumber = blockNumber;
        this.confirmedBlockHash = blockHash;
    }
}
