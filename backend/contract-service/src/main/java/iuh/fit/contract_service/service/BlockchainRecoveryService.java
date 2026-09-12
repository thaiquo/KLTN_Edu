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

    public BlockchainRecoveryService(JdbcTemplate jdbc, BlockchainTransactionRepository transactions,
            SessionSettlementRepository settlements, DisputeRepository disputes,
            OutboxEventRepository outbox, OperationalFundingPolicy funding, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.settlements = settlements;
        this.disputes = disputes;
        this.outbox = outbox;
        this.funding = funding;
        this.mapper = mapper;
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
        audit.put("actorId", actorId);
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
