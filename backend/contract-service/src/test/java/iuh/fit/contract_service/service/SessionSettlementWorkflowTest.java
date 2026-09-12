package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EscrowEventType;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.web3j.crypto.Hash;
import tools.jackson.databind.ObjectMapper;

import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class SessionSettlementWorkflowTest {
    @Autowired private BlockchainRecoveryService recoveryService;

    @Test
    void rejectsUnfundedActiveAgreementAndRollsBackPendingSettlement() {
        UUID id = UUID.randomUUID();
        insertAgreement(id, Hash.sha3String("agreement:" + id), Hash.sha3String("terms"), "ACTIVE", 1);
        jdbcTemplate.update("DELETE FROM processed_event");
        assertThrows(IllegalStateException.class, () -> workflowService.initiateSessionProposal(
                id, 1L, SettlementOutcome.BOTH_PRESENT, Hash.sha3String("evidence")));
        assertEquals(0, sessionSettlementRepository.count());
        assertEquals(0, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM blockchain_transaction", Integer.class));
    }

    @Test
    void eventForAnotherAgreementOrContractCannotAuthorizeFunding() {
        UUID id = UUID.randomUUID();
        insertAgreement(id, Hash.sha3String("agreement:" + id), Hash.sha3String("terms"), "ACTIVE", 1);
        jdbcTemplate.update("UPDATE processed_event SET contract_address = ?", STUDENT);
        assertThrows(IllegalStateException.class, () -> workflowService.initiateSessionProposal(
                id, 1L, SettlementOutcome.BOTH_PRESENT, Hash.sha3String("evidence")));
        jdbcTemplate.update("UPDATE processed_event SET contract_address = ?, decoded_payload = ?", ESCROW,
                "{\"type\":\"AGREEMENT_FUNDED\",\"agreementId\":\"wrong\",\"attributes\":{}}");
        assertThrows(IllegalStateException.class, () -> workflowService.initiateSessionProposal(
                id, 1L, SettlementOutcome.BOTH_PRESENT, Hash.sha3String("evidence")));
    }

    @Test
    void knownFailureCanBeRetriedWithAuditButUnknownReceiptCannot() {
        UUID id = UUID.randomUUID();
        insertAgreement(id, Hash.sha3String("agreement:" + id), Hash.sha3String("terms"), "ACTIVE", 1);
        var intent = workflowService.initiateSessionProposal(id, 1L, SettlementOutcome.BOTH_PRESENT,
                Hash.sha3String("evidence"));
        jdbcTemplate.update("UPDATE blockchain_transaction SET status = 'FAILED', error_message = 'RPC unavailable' WHERE id = ?",
                intent.transactionId());
        recoveryService.reconcileKnownFailures();
        assertEquals(SettlementStatus.FAILED_RETRYABLE,
                sessionSettlementRepository.findByAgreementId(id).getFirst().getStatus());
        recoveryService.retry(intent.transactionId(), 9L);
        assertEquals(SettlementStatus.PROPOSE_PENDING,
                sessionSettlementRepository.findByAgreementId(id).getFirst().getStatus());
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'blockchain.transaction.retry.v1'", Integer.class));
        jdbcTemplate.update("UPDATE blockchain_transaction SET status = 'FAILED', transaction_hash = ?, receipt_status = NULL WHERE id = ?",
                Hash.sha3String("unknown"), intent.transactionId());
        assertThrows(IllegalStateException.class, () -> recoveryService.retry(intent.transactionId(), 9L));
        recoveryService.reconcileKnownFailures();
        assertEquals("SUBMITTED", jdbcTemplate.queryForObject(
                "SELECT status FROM blockchain_transaction WHERE id = ?", String.class, intent.transactionId()));
    }

    @Test
    void quarantinedAgreementCannotRetryAnOldIntent() {
        UUID id = UUID.randomUUID();
        insertAgreement(id, Hash.sha3String("agreement:" + id), Hash.sha3String("terms"), "ACTIVE", 1);
        var intent = workflowService.initiateSessionProposal(id, 1L, SettlementOutcome.BOTH_PRESENT, Hash.sha3String("evidence"));
        jdbcTemplate.update("UPDATE blockchain_transaction SET status = 'FAILED' WHERE id = ?", intent.transactionId());
        jdbcTemplate.update("UPDATE contract_agreement SET legacy_excluded = TRUE WHERE id = ?", id);
        assertThrows(IllegalStateException.class, () -> recoveryService.retry(intent.transactionId(), 9L));
    }

    @Autowired
    private SessionSettlementWorkflowService workflowService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private SessionSettlementRepository sessionSettlementRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private static final long CHAIN_ID = 31337L;
    private static final String ESCROW = "0x0000000000000000000000000000000000000004";
    private static final String PLATFORM = "0x0000000000000000000000000000000000000003";
    private static final String STUDENT = "0x0000000000000000000000000000000000000001";
    private static final String TUTOR = "0x0000000000000000000000000000000000000002";
    private static final String TOKEN = "0x0000000000000000000000000000000000000005";

    @BeforeEach
    void cleanUp() {
        jdbcTemplate.execute("DELETE FROM outbox_event");
        jdbcTemplate.execute("DELETE FROM blockchain_transaction");
        jdbcTemplate.execute("DELETE FROM processed_event");
        jdbcTemplate.execute("DELETE FROM dispute");
        jdbcTemplate.execute("DELETE FROM session_settlement");
        jdbcTemplate.execute("DELETE FROM escrow_payment");
        jdbcTemplate.execute("DELETE FROM contract_agreement");
    }

    @Test
    void initiateSessionProposalCreatesTransactionIntentAndPendingSettlement() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 10);

        String evidenceHash = "0x" + "e".repeat(64);
        BlockchainTransactionIntentResult result = workflowService.initiateSessionProposal(
                agreementId, 1L, SettlementOutcome.BOTH_PRESENT, evidenceHash);

        assertNotNull(result);
        assertTrue(result.created());
        assertEquals("PROPOSE:" + CHAIN_ID + ":" + agreementId + ":1", result.idempotencyKey());

        SessionSettlement settlement = sessionSettlementRepository
                .findByAgreementIdAndSessionId(agreementId, 1L).orElseThrow();
        assertEquals(SettlementStatus.PROPOSE_PENDING, settlement.getStatus());
        assertEquals(evidenceHash, settlement.getProposalEvidenceHash());
    }

    @Test
    void processConfirmedSessionProposalEventTransitionsToProposed() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 10);

        String evidenceHash = "0x" + "e".repeat(64);
        workflowService.initiateSessionProposal(agreementId, 1L, SettlementOutcome.BOTH_PRESENT, evidenceHash);

        String onchainSessionId = SessionSettlementWorkflowService.computeOnchainSessionId(1L);

        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("agreementId", onchainAgreementId);
        attributes.put("sessionId", onchainSessionId);
        attributes.put("outcome", "0");
        attributes.put("disputeDeadline", "1800000000");
        attributes.put("evidenceHash", evidenceHash);

        DecodedEscrowEvent decodedEvent = new DecodedEscrowEvent(
                EscrowEventType.SESSION_SETTLEMENT_PROPOSED,
                onchainAgreementId,
                onchainSessionId,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decodedEvent);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                110L,
                "0x" + "b".repeat(64),
                "0x" + "p".repeat(64),
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "SESSION_SETTLEMENT_PROPOSED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        boolean processed = workflowService.processConfirmedSessionProposalEvent(event);
        assertTrue(processed);

        SessionSettlement settlement = sessionSettlementRepository
                .findByAgreementIdAndSessionId(agreementId, 1L).orElseThrow();
        assertEquals(SettlementStatus.PROPOSED, settlement.getStatus());
        assertNotNull(settlement.getDisputeDeadline());

        long outboxCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'session.settlement.proposed.v1'", Long.class);
        assertEquals(1L, outboxCount);
    }

    @Test
    void initiateSessionFinalizationFailsWhenDisputeDeadlineActive() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 10);

        String evidenceHash = "0x" + "e".repeat(64);
        workflowService.initiateSessionProposal(agreementId, 1L, SettlementOutcome.BOTH_PRESENT, evidenceHash);

        SessionSettlement settlement = sessionSettlementRepository
                .findByAgreementIdAndSessionId(agreementId, 1L).orElseThrow();
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(12), "0x" + "p".repeat(64));
        sessionSettlementRepository.saveAndFlush(settlement);

        assertThrows(IllegalStateException.class, () -> workflowService.initiateSessionFinalization(settlement.getId()));
    }

    @Test
    void processConfirmedSessionSettledEventTransitionsToSettledAndCompletesAgreement() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 1); // Only 1 session total

        String evidenceHash = "0x" + "e".repeat(64);
        workflowService.initiateSessionProposal(agreementId, 1L, SettlementOutcome.BOTH_PRESENT, evidenceHash);

        SessionSettlement settlement = sessionSettlementRepository
                .findByAgreementIdAndSessionId(agreementId, 1L).orElseThrow();
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).minusHours(1), "0x" + "p".repeat(64));
        sessionSettlementRepository.saveAndFlush(settlement);

        String onchainSessionId = SessionSettlementWorkflowService.computeOnchainSessionId(1L);

        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("agreementId", onchainAgreementId);
        attributes.put("sessionId", onchainSessionId);
        attributes.put("outcome", "0");
        attributes.put("finalStatus", "3"); // SETTLED
        attributes.put("tutorAmount", "34000000");
        attributes.put("platformAmount", "6000000");
        attributes.put("studentRefund", "0");

        DecodedEscrowEvent decodedEvent = new DecodedEscrowEvent(
                EscrowEventType.SESSION_SETTLED,
                onchainAgreementId,
                onchainSessionId,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decodedEvent);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                120L,
                "0x" + "b".repeat(64),
                "0x" + "f".repeat(64),
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "SESSION_SETTLED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        boolean processed = workflowService.processConfirmedSessionSettledEvent(event);
        assertTrue(processed);

        SessionSettlement updatedSettlement = sessionSettlementRepository.findById(settlement.getId()).orElseThrow();
        assertEquals(SettlementStatus.SETTLED, updatedSettlement.getStatus());

        ContractAgreement activeAgreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.ACTIVE, activeAgreement.getStatus());

        long settledOutboxCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'session.settled.v1'", Long.class);
        assertEquals(1L, settledOutboxCount);

        assertEquals(BigInteger.valueOf(34_000_000L), updatedSettlement.getTutorAmount());
        assertEquals(BigInteger.valueOf(6_000_000L), updatedSettlement.getPlatformAmount());
        assertEquals(BigInteger.ZERO, updatedSettlement.getStudentRefundAmount());
    }

    private void insertAgreement(UUID id, String onchainAgreementId, String termsHash, String status, int totalSessions) {
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, 1, 1, 2,
                    ?, ?, ?, ?,
                    ?, ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 40000000,
                    ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, STUDENT, TUTOR, PLATFORM, CHAIN_ID,
                ESCROW, TOKEN, termsHash, totalSessions, status);
        FundingTestEvidence.insert(jdbcTemplate, id);
    }
}
