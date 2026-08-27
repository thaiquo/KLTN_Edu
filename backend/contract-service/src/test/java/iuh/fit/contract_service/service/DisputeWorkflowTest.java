package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EscrowEventType;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
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
class DisputeWorkflowTest {

    @Autowired
    private DisputeWorkflowService workflowService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private SessionSettlementRepository sessionSettlementRepository;

    @Autowired
    private DisputeRepository disputeRepository;

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
        jdbcTemplate.execute("DELETE FROM dispute_evidence");
        jdbcTemplate.execute("DELETE FROM dispute");
        jdbcTemplate.execute("DELETE FROM session_settlement");
        jdbcTemplate.execute("DELETE FROM escrow_payment");
        jdbcTemplate.execute("DELETE FROM contract_agreement");
    }

    @Test
    void studentCanOpenDisputeWithin24hWindow() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 1, "staff1@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        String onchainSessionId = Hash.sha3String("EDUCONNECT:SESSION:1");
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, onchainSessionId, SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(20), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        String evidenceHash = "0x" + "c".repeat(64);
        BlockchainTransactionIntentResult result = workflowService.initiateDisputeOpening(
                settlement.getId(),
                101L, // student ID
                evidenceHash,
                "disputes/session1_evidence.pdf",
                "application/pdf",
                "sha256_placeholder");

        assertNotNull(result);
        assertTrue(result.created());
        assertEquals("OPEN_DISPUTE:" + CHAIN_ID + ":" + agreementId + ":1", result.idempotencyKey());

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        assertEquals(DisputeStatus.OPENING, dispute.getStatus());
        assertEquals(101L, dispute.getComplainantId());

        SessionSettlement updatedSettlement = sessionSettlementRepository.findById(settlement.getId()).orElseThrow();
        assertEquals(SettlementStatus.DISPUTED, updatedSettlement.getStatus());
    }

    @Test
    void cannotOpenDisputeAfterDeadline() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 1, "staff1@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        String onchainSessionId = Hash.sha3String("EDUCONNECT:SESSION:1");
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, onchainSessionId, SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        // Deadline expired 1 hour ago
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).minusHours(1), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        assertThrows(IllegalStateException.class, () -> workflowService.initiateDisputeOpening(
                settlement.getId(),
                101L,
                "0x" + "c".repeat(64),
                "obj_key", "application/pdf", "sha256"));
    }

    @Test
    void nonStudentCannotOpenDispute() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 1, "staff1@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        String onchainSessionId = Hash.sha3String("EDUCONNECT:SESSION:1");
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, onchainSessionId, SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(12), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        assertThrows(SecurityException.class, () -> workflowService.initiateDisputeOpening(
                settlement.getId(),
                999L, // wrong student
                "0x" + "c".repeat(64),
                "obj_key", "application/pdf", "sha256"));
    }

    @Test
    void processConfirmedDisputeOpenedEventUpdatesDisputeToOpen() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 1, "staff1@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        String onchainSessionId = Hash.sha3String("EDUCONNECT:SESSION:1");
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, onchainSessionId, SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(12), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        workflowService.initiateDisputeOpening(
                settlement.getId(), 101L, "0x" + "c".repeat(64), "obj_key", "application/pdf", "sha256");

        String txHash = "0x" + "d".repeat(64);
        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("agreementId", onchainAgreementId);
        attributes.put("sessionId", onchainSessionId);
        attributes.put("evidenceHash", "0x" + "c".repeat(64));

        DecodedEscrowEvent decoded = new DecodedEscrowEvent(
                EscrowEventType.TUTOR_FRAUD_DISPUTE_OPENED,
                onchainAgreementId,
                onchainSessionId,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decoded);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                120L,
                "0x" + "e".repeat(64),
                txHash,
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "TUTOR_FRAUD_DISPUTE_OPENED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        boolean processed = workflowService.processConfirmedDisputeOpenedEvent(event);
        assertTrue(processed);

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        assertEquals(DisputeStatus.OPEN, dispute.getStatus());
        assertEquals(txHash, dispute.getOpenTxHash());
    }

    @Test
    void staffCanResolveOnlyApprovedClassroom() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 1, "staff_reviewer@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        String onchainSessionId = Hash.sha3String("EDUCONNECT:SESSION:1");
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, onchainSessionId, SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(12), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        workflowService.initiateDisputeOpening(
                settlement.getId(), 101L, "0x" + "c".repeat(64), "obj_key", "application/pdf", "sha256");

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        dispute.markOpen("0x" + "d".repeat(64));
        disputeRepository.save(dispute);

        // 1. Wrong staff attempts resolution -> rejected
        assertThrows(SecurityException.class, () -> workflowService.initiateDisputeResolution(
                dispute.getId(), 202L, "wrong_staff@educonnect.com", "STAFF", true, "reason", "0x" + "f".repeat(64)));

        // 2. Correct staff attempts resolution -> permitted
        BlockchainTransactionIntentResult staffResult = workflowService.initiateDisputeResolution(
                dispute.getId(), 201L, "staff_reviewer@educonnect.com", "STAFF", true, "reason", "0x" + "f".repeat(64));
        assertNotNull(staffResult);
        assertEquals("RESOLVE:" + CHAIN_ID + ":" + agreementId + ":1", staffResult.idempotencyKey());
    }

    @Test
    void adminCanResolveAnyDispute() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 1, "different_staff@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        String onchainSessionId = Hash.sha3String("EDUCONNECT:SESSION:1");
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, onchainSessionId, SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(12), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        workflowService.initiateDisputeOpening(
                settlement.getId(), 101L, "0x" + "c".repeat(64), "obj_key", "application/pdf", "sha256");

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        dispute.markOpen("0x" + "d".repeat(64));
        disputeRepository.save(dispute);

        // ADMIN can resolve regardless of reviewer
        BlockchainTransactionIntentResult adminResult = workflowService.initiateDisputeResolution(
                dispute.getId(), 999L, "admin@educonnect.com", "ADMIN", false, "admin reason", "0x" + "f".repeat(64));
        assertNotNull(adminResult);
        assertEquals("RESOLVE:" + CHAIN_ID + ":" + agreementId + ":1", adminResult.idempotencyKey());
    }

    @Test
    void processConfirmedDisputeResolvedEventMarksSettlementRefundedAndCompletesAgreement() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE", 1, "staff_reviewer@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        String onchainSessionId = Hash.sha3String("EDUCONNECT:SESSION:1");
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, onchainSessionId, SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(12), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        workflowService.initiateDisputeOpening(
                settlement.getId(), 101L, "0x" + "c".repeat(64), "obj_key", "application/pdf", "sha256");

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        dispute.markOpen("0x" + "d".repeat(64));
        disputeRepository.save(dispute);

        workflowService.initiateDisputeResolution(
                dispute.getId(), 201L, "staff_reviewer@educonnect.com", "STAFF", true, "Valid evidence", "0x" + "f".repeat(64));

        String txHash = "0x" + "9".repeat(64);
        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("agreementId", onchainAgreementId);
        attributes.put("sessionId", onchainSessionId);
        attributes.put("complaintApproved", "true");
        attributes.put("resolutionHash", "0x" + "f".repeat(64));

        DecodedEscrowEvent decoded = new DecodedEscrowEvent(
                EscrowEventType.TUTOR_FRAUD_DISPUTE_RESOLVED,
                onchainAgreementId,
                onchainSessionId,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decoded);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "2".repeat(64)),
                "0x",
                130L,
                "0x" + "e".repeat(64),
                txHash,
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "TUTOR_FRAUD_DISPUTE_RESOLVED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        boolean processed = workflowService.processConfirmedDisputeResolvedEvent(event);
        assertTrue(processed);

        Dispute resolvedDispute = disputeRepository.findById(dispute.getId()).orElseThrow();
        assertEquals(DisputeStatus.APPROVED, resolvedDispute.getStatus());
        assertEquals("APPROVED", resolvedDispute.getResolution());
        assertEquals(txHash, resolvedDispute.getResolveTxHash());

        SessionSettlement refundedSettlement = sessionSettlementRepository.findById(settlement.getId()).orElseThrow();
        assertEquals(SettlementStatus.REFUNDED, refundedSettlement.getStatus());

        ContractAgreement completedAgreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.COMPLETED, completedAgreement.getStatus());
    }

    private void insertAgreement(UUID id, String onchainAgreementId, String termsHash, String status, int totalSessions, String reviewerEmail) {
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    classroom_reviewer_email,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, 1001, 101, 102,
                    ?,
                    ?, ?, ?, ?,
                    ?, ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 40000000,
                    ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, reviewerEmail,
                STUDENT, TUTOR, PLATFORM, CHAIN_ID,
                ESCROW, TOKEN, termsHash, totalSessions, status);
    }
}
