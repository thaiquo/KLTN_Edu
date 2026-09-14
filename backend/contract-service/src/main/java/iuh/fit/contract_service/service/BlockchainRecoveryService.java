package iuh.fit.contract_service.service;

import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.UUID;

@Service
public class BlockchainRecoveryService {
    private final JdbcTemplate jdbc;
    private final BlockchainTransactionRepository transactions;
    private final SessionSettlementRepository settlements;
    private final DisputeRepository disputes;
    private final OutboxEventRepository outbox;
    private final OperationalFundingPolicy funding;
    private final ObjectMapper mapper;
    private final org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    public BlockchainRecoveryService(JdbcTemplate jdbc, BlockchainTransactionRepository transactions,
            SessionSettlementRepository settlements, DisputeRepository disputes,
            OutboxEventRepository outbox, OperationalFundingPolicy funding, ObjectMapper mapper,
            org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.settlements = settlements;
        this.disputes = disputes;
        this.outbox = outbox;
        this.funding = funding;
        this.mapper = mapper;
        this.transactionTemplate = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
    }

    @Scheduled(initialDelay = 10000, fixedDelay = 15000)
    @Transactional
    public void reconcileKnownFailures() {
        jdbc.update("""
                UPDATE blockchain_transaction SET status = 'SUBMITTED', version = version + 1,
                    error_message = 'Receipt outcome unknown; reconciliation resumed', updated_at = CURRENT_TIMESTAMP
                WHERE status = 'FAILED' AND transaction_hash IS NOT NULL AND receipt_status IS NULL
                """);
        // Conditional SQL preserves confirmed event transitions and optimistic versions.
        jdbc.update("""
                UPDATE session_settlement SET status = 'FAILED_RETRYABLE', version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE status IN ('PROPOSE_PENDING', 'FINALIZE_PENDING', 'DISPUTE_OPENING')
                AND EXISTS (SELECT 1 FROM blockchain_transaction t WHERE t.settlement_id = session_settlement.id
                    AND t.status = 'FAILED' AND (t.transaction_hash IS NULL OR t.receipt_status = 0)
                    AND ((t.action = 'PROPOSE' AND session_settlement.status = 'PROPOSE_PENDING')
                      OR (t.action = 'FINALIZE' AND session_settlement.status = 'FINALIZE_PENDING')
                      OR (t.action = 'OPEN_DISPUTE' AND session_settlement.status = 'DISPUTE_OPENING')))
                """);
        jdbc.update("""
                UPDATE dispute SET status = 'FAILED_RETRYABLE', version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE status IN ('OPENING', 'RESOLUTION_PENDING')
                AND EXISTS (SELECT 1 FROM blockchain_transaction t WHERE t.settlement_id = dispute.settlement_id
                    AND t.status = 'FAILED' AND (t.transaction_hash IS NULL OR t.receipt_status = 0)
                    AND ((t.action = 'OPEN_DISPUTE' AND dispute.status = 'OPENING')
                      OR (t.action = 'RESOLVE' AND dispute.status = 'RESOLUTION_PENDING')))
                """);
    }

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(BlockchainRecoveryService.class);
    private static final int MAX_AUTO_RETRIES = 5;

    @Scheduled(initialDelay = 20000, fixedDelay = 30000)
    public void autoRetryEligibleFailures() {
        var threshold = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5);
        var eligibleTxIds = jdbc.queryForList("""
                SELECT tx.id
                FROM blockchain_transaction tx
                JOIN contract_agreement agreement ON agreement.id = tx.agreement_id
                WHERE tx.status = 'FAILED'
                  AND tx.transaction_hash IS NULL
                  AND tx.receipt_status IS NULL
                  AND tx.updated_at <= ?
                  AND agreement.legacy_excluded = FALSE
                  AND (
                    (tx.action = 'REGISTER' AND agreement.status = 'PREPARING_BLOCKCHAIN')
                    OR (tx.action = 'EXPIRE' AND agreement.status = 'WAITING_PAYMENT')
                    OR (tx.action IN ('PROPOSE', 'FINALIZE', 'OPEN_DISPUTE', 'RESOLVE')
                        AND agreement.status = 'ACTIVE'
                        AND EXISTS (
                          SELECT 1
                          FROM escrow_payment payment
                          JOIN processed_event event
                            ON event.event_type = 'AGREEMENT_FUNDED'
                           AND event.chain_id = payment.chain_id
                           AND LOWER(event.transaction_hash) = LOWER(payment.fund_tx_hash)
                           AND LOWER(event.contract_address) = LOWER(agreement.escrow_contract_address)
                          WHERE payment.agreement_id = agreement.id
                            AND payment.fund_tx_hash IS NOT NULL
                            AND payment.chain_id = agreement.chain_id
                        ))
                  )
                  AND (SELECT COUNT(*) FROM outbox_event audit
                       WHERE audit.aggregate_id = CAST(tx.id AS VARCHAR)
                         AND audit.event_type = 'blockchain.transaction.retry.v1') < ?
                ORDER BY tx.updated_at ASC
                LIMIT 10
                """, UUID.class, threshold, MAX_AUTO_RETRIES);

        for (UUID txId : eligibleTxIds) {
            try {
                Integer retryCount = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM outbox_event WHERE aggregate_id = ? AND event_type = 'blockchain.transaction.retry.v1'",
                        Integer.class, txId.toString());
                if (retryCount != null && retryCount >= MAX_AUTO_RETRIES) {
                    log.warn("Transaction {} has reached max auto-retry limit ({}); skipping automated retry", txId, MAX_AUTO_RETRIES);
                    continue;
                }
                // A missing transaction hash proves that nothing was broadcast, so
                // retrying cannot duplicate a payout. Confirmed reverts and unknown
                // receipts remain manual/audited recovery cases.
                transactionTemplate.execute(status -> retry(txId, null));
                log.info("Successfully initiated automated retry for failed transaction {}", txId);
            } catch (Exception ex) {
                log.warn("Automated retry skipped for transaction {}: {}", txId, ex.getMessage());
            }
        }
    }

    @Transactional
    public UUID retry(UUID transactionId, Long actorId) {
        var tx = transactions.lockById(transactionId).orElseThrow();
        var action = BlockchainTransactionAction.valueOf(tx.getAction());
        if (action == BlockchainTransactionAction.REGISTER || action == BlockchainTransactionAction.EXPIRE) {
            String expected = action == BlockchainTransactionAction.REGISTER ? "PREPARING_BLOCKCHAIN" : "WAITING_PAYMENT";
            Integer eligible = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM contract_agreement WHERE id = ? AND legacy_excluded = FALSE AND status = ?",
                    Integer.class, tx.getAgreementId(), expected);
            if (eligible == null || eligible != 1) throw new IllegalStateException("Agreement cannot retry this lifecycle action");
        }
        funding.requireCommand(new BlockchainTransactionCommand(tx.getIdempotencyKey(), action, tx.getChainId(),
                tx.getFromAddress(), tx.getToAddress(), tx.getCalldata(), tx.getCalldataHash(),
                tx.getAgreementId(), tx.getSettlementId(), null));
        if (tx.getStatus() != BlockchainTransactionStatus.FAILED
                || (tx.getTransactionHash() != null && !Short.valueOf((short) 0).equals(tx.getReceiptStatus()))) {
            throw new IllegalStateException("Transaction outcome is not a proven failure; keep reconciling its receipt");
        }
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        if (action.isSettlementScoped()) {
            var settlement = settlements.findById(tx.getSettlementId()).orElseThrow();
            if (settlement.getStatus() == SettlementStatus.SETTLED || settlement.getStatus() == SettlementStatus.REFUNDED
                    || settlement.getStatus() == SettlementStatus.EXCLUDED_LEGACY) {
                throw new IllegalStateException("Settlement is already terminal");
            }
            switch (action) {
                case PROPOSE -> {
                    if (settlement.getProposeTxHash() != null) throw new IllegalStateException("Proposal already confirmed");
                    settlement.markProposePending();
                }
                case FINALIZE -> {
                    if (settlement.getDisputeDeadline() == null || !now.isAfter(settlement.getDisputeDeadline())
                            || disputes.findBySettlementId(settlement.getId()).isPresent()) {
                        throw new IllegalStateException("Finalization requires an expired, undisputed proposal");
                    }
                    settlement.markFinalizePending();
                }
                case OPEN_DISPUTE -> {
                    if (settlement.getDisputeDeadline() == null || now.isAfter(settlement.getDisputeDeadline())) {
                        throw new IllegalStateException("On-chain dispute deadline has passed; cannot retry opening");
                    }
                    settlement.markDisputeOpening();
                    var dispute = disputes.findBySettlementId(settlement.getId()).orElseThrow();
                    dispute.setStatus(DisputeStatus.OPENING);
                    disputes.save(dispute);
                }
                case RESOLVE -> {
                    var dispute = disputes.findBySettlementId(settlement.getId()).orElseThrow();
                    if (dispute.getOpenTxHash() == null || dispute.getResolveTxHash() != null) {
                        throw new IllegalStateException("Dispute must be confirmed open and unresolved");
                    }
                    dispute.markResolutionPending();
                    disputes.save(dispute);
                }
                default -> throw new IllegalStateException("Unsupported settlement retry");
            }
            settlements.save(settlement);
        }
        var audit = new LinkedHashMap<String, Object>();
        audit.put("transactionId", tx.getId());
        audit.put("actorId", actorId != null ? actorId : 0L);
        audit.put("action", tx.getAction());
        audit.put("previousHash", tx.getTransactionHash());
        audit.put("previousNonce", tx.getNonce());
        audit.put("receiptStatus", tx.getReceiptStatus());
        audit.put("blockNumber", tx.getBlockNumber());
        audit.put("error", tx.getErrorMessage());
        audit.put("attemptCount", tx.getAttemptCount());
        outbox.save(OutboxEvent.create("blockchain.transaction.retry.v1", "BlockchainTransaction",
                tx.getId().toString(), null, mapper.writeValueAsString(audit), now));
        tx.retryKnownFailure(now);
        transactions.save(tx);
        return tx.getId();
    }
}
