package iuh.fit.contract_service.entity;

import iuh.fit.contract_service.domain.BlockchainTransactionStateMachine;
import iuh.fit.contract_service.enums.BlockchainTransactionStatus;
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

import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Entity
@Table(name = "blockchain_transaction")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BlockchainTransaction {
    @Id
    private UUID id;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private String idempotencyKey;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(name = "chain_id", nullable = false)
    private Long chainId;

    @Column(name = "from_address", nullable = false, length = 42)
    private String fromAddress;

    @Column(name = "to_address", nullable = false, length = 42)
    private String toAddress;

    @Column(name = "calldata_hash", nullable = false, length = 66)
    private String calldataHash;

    @Column(columnDefinition = "TEXT")
    private String calldata;

    @Column(name = "transaction_hash", length = 66)
    private String transactionHash;

    @Column(precision = 78, scale = 0)
    private BigInteger nonce;

    @Column(name = "signed_raw_transaction", columnDefinition = "TEXT")
    private String signedRawTransaction;

    @Column(name = "dispatch_started_at")
    private OffsetDateTime dispatchStartedAt;

    @Column(name = "agreement_id")
    private UUID agreementId;

    @Column(name = "settlement_id")
    private UUID settlementId;

    @Column(name = "receipt_status")
    private Short receiptStatus;

    @Column(name = "block_number")
    private Long blockNumber;

    @Column(name = "block_hash", length = 66)
    private String blockHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BlockchainTransactionStatus status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount;

    @Column(name = "next_attempt_at")
    private OffsetDateTime nextAttemptAt;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public static BlockchainTransaction createIntent(
            String idempotencyKey,
            String action,
            long chainId,
            String fromAddress,
            String toAddress,
            String calldata,
            String calldataHash,
            UUID agreementId,
            UUID settlementId,
            OffsetDateTime now) {
        BlockchainTransaction transaction = new BlockchainTransaction();
        transaction.id = UUID.randomUUID();
        transaction.idempotencyKey = idempotencyKey;
        transaction.action = action;
        transaction.chainId = chainId;
        transaction.fromAddress = fromAddress;
        transaction.toAddress = toAddress;
        transaction.calldata = calldata;
        transaction.calldataHash = calldataHash;
        transaction.agreementId = agreementId;
        transaction.settlementId = settlementId;
        transaction.status = BlockchainTransactionStatus.CREATED;
        transaction.attemptCount = 0;
        transaction.createdAt = now;
        transaction.updatedAt = now;
        return transaction;
    }

    public boolean matchesIntent(
            String expectedAction,
            long expectedChainId,
            String expectedFromAddress,
            String expectedToAddress,
            String expectedCalldata,
            String expectedCalldataHash,
            UUID expectedAgreementId,
            UUID expectedSettlementId) {
        return action.equals(expectedAction)
                && chainId == expectedChainId
                && fromAddress.equalsIgnoreCase(expectedFromAddress)
                && toAddress.equalsIgnoreCase(expectedToAddress)
                && calldata.equalsIgnoreCase(expectedCalldata)
                && calldataHash.equalsIgnoreCase(expectedCalldataHash)
                && java.util.Objects.equals(agreementId, expectedAgreementId)
                && java.util.Objects.equals(settlementId, expectedSettlementId);
    }

    public void transitionTo(BlockchainTransactionStatus target) {
        BlockchainTransactionStateMachine.requireTransition(status, target);
        status = target;
        updatedAt = OffsetDateTime.now();
    }

    public void claimForDispatch(OffsetDateTime now) {
        BlockchainTransactionStateMachine.requireTransition(status, BlockchainTransactionStatus.DISPATCHING);
        status = BlockchainTransactionStatus.DISPATCHING;
        dispatchStartedAt = now;
        attemptCount += 1;
        errorMessage = null;
        updatedAt = now;
    }

    public void recordPreparedTransaction(
            BigInteger assignedNonce,
            String expectedTransactionHash,
            String signedTransaction,
            OffsetDateTime now) {
        if (status != BlockchainTransactionStatus.DISPATCHING) {
            throw new IllegalStateException("Only a DISPATCHING transaction can be prepared");
        }
        nonce = assignedNonce;
        transactionHash = expectedTransactionHash;
        signedRawTransaction = signedTransaction;
        updatedAt = now;
    }

    public void markSubmitted(String actualTransactionHash, OffsetDateTime now) {
        if (transactionHash == null || !transactionHash.equalsIgnoreCase(actualTransactionHash)) {
            throw new IllegalArgumentException("RPC transaction hash differs from signed transaction hash");
        }
        BlockchainTransactionStateMachine.requireTransition(status, BlockchainTransactionStatus.SUBMITTED);
        status = BlockchainTransactionStatus.SUBMITTED;
        errorMessage = null;
        updatedAt = now;
    }

    public void recordUncertainBroadcast(String message, OffsetDateTime retryAt, OffsetDateTime now) {
        if (status != BlockchainTransactionStatus.DISPATCHING || transactionHash == null) {
            throw new IllegalStateException("Only a prepared DISPATCHING transaction can be uncertain");
        }
        errorMessage = message;
        nextAttemptAt = retryAt;
        updatedAt = now;
    }

    public void failBeforeBroadcast(String message, OffsetDateTime now) {
        if (status != BlockchainTransactionStatus.DISPATCHING || transactionHash != null) {
            throw new IllegalStateException("Only an unprepared DISPATCHING transaction can fail before broadcast");
        }
        BlockchainTransactionStateMachine.requireTransition(status, BlockchainTransactionStatus.FAILED);
        status = BlockchainTransactionStatus.FAILED;
        errorMessage = message;
        nextAttemptAt = null;
        updatedAt = now;
    }

    public void confirm(short statusValue, long confirmedBlockNumber, String confirmedBlockHash, OffsetDateTime now) {
        if (status == BlockchainTransactionStatus.DISPATCHING) {
            BlockchainTransactionStateMachine.requireTransition(status, BlockchainTransactionStatus.SUBMITTED);
            status = BlockchainTransactionStatus.SUBMITTED;
        }
        BlockchainTransactionStateMachine.requireTransition(status, BlockchainTransactionStatus.CONFIRMED);
        status = BlockchainTransactionStatus.CONFIRMED;
        receiptStatus = statusValue;
        blockNumber = confirmedBlockNumber;
        blockHash = confirmedBlockHash;
        signedRawTransaction = null;
        errorMessage = null;
        nextAttemptAt = null;
        updatedAt = now;
    }

    public void fail(short statusValue, Long failedBlockNumber, String failedBlockHash, String message, OffsetDateTime now) {
        BlockchainTransactionStateMachine.requireTransition(status, BlockchainTransactionStatus.FAILED);
        status = BlockchainTransactionStatus.FAILED;
        receiptStatus = statusValue;
        blockNumber = failedBlockNumber;
        blockHash = failedBlockHash;
        signedRawTransaction = null;
        errorMessage = message;
        nextAttemptAt = null;
        updatedAt = now;
    }
}
