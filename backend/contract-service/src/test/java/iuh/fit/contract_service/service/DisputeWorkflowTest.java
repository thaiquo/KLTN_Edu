package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EscrowEventType;
import iuh.fit.contract_service.api.ContractManagementController;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
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
import iuh.fit.contract_service.repository.DisputeEvidenceRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.web3j.crypto.Hash;
import tools.jackson.databind.ObjectMapper;

import java.math.BigInteger;
import java.time.Instant;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.times;

@SpringBootTest
class DisputeWorkflowTest {

    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private NotificationDispatcher notificationDispatcher;

    @Autowired
    private DisputeWorkflowService workflowService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private SessionSettlementRepository sessionSettlementRepository;

    @Autowired
    private DisputeRepository disputeRepository;

    @Autowired
    private DisputeEvidenceRepository disputeEvidenceRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ContractManagementController contractManagementController;

    private static final long CHAIN_ID = 31337L;
    private static final String ESCROW = "0x0000000000000000000000000000000000000004";
    private static final String PLATFORM = "0x0000000000000000000000000000000000000003";
    private static final String STUDENT = "0x0000000000000000000000000000000000000001";
    private static final String TUTOR = "0x0000000000000000000000000000000000000002";
    private static final String TOKEN = "0x0000000000000000000000000000000000000005";

    @BeforeEach
    void cleanUp() {
        SecurityContextHolder.clearContext();
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
                "STUDENT",
                "Tutor did not teach the recorded session",
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
        assertEquals("STUDENT", dispute.getComplainantRole());
        assertEquals("Tutor did not teach the recorded session", dispute.getReason());
        assertEquals(1, disputeEvidenceRepository.findByDisputeId(dispute.getId()).size());

        List<Dispute> disputesForApi = disputeRepository.findAllWithSettlementAndAgreement();
        assertEquals(1, disputesForApi.size());
        assertEquals(agreementId, disputesForApi.getFirst().getSettlement().getAgreement().getId());
        ContractUserPrincipal admin = new ContractUserPrincipal(
                4L, "admin@educonnect.com", "ADMIN", List.of("ADMIN"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null, List.of()));
        var apiPage = contractManagementController.listDisputes(
                null, org.springframework.data.domain.PageRequest.of(0, 100));
        assertEquals(1, apiPage.getBody().getTotalElements());

        SessionSettlement updatedSettlement = sessionSettlementRepository.findById(settlement.getId()).orElseThrow();
        assertEquals(SettlementStatus.DISPUTE_OPENING, updatedSettlement.getStatus());
        verify(notificationDispatcher).sendAsync(any(), any(), anyString(), anyString(),
                anyString(), anyString(), anyString());
    }

    @Test
    void tutorCanSubmitPrivateComplaintWithin24hAndImmediatelyHoldOwnStudentSettlement() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertAgreement(agreementId, onchainAgreementId, Hash.sha3String("terms-v1"),
                "ACTIVE", 1, "staff1@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, Hash.sha3String("EDUCONNECT:SESSION:1"), SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(20), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        workflowService.initiateDisputeOpening(
                settlement.getId(), 102L, "TUTOR", "Student disrupted the session",
                "0x" + "c".repeat(64), "disputes/tutor-evidence.pdf", "application/pdf", null);

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        assertEquals("TUTOR", dispute.getComplainantRole());
        assertEquals("STUDENT_MISCONDUCT", dispute.getType());
        assertEquals(DisputeStatus.OPENING, dispute.getStatus());
        assertTrue(disputeEvidenceRepository.findByDisputeId(dispute.getId()).stream()
                .anyMatch(item -> "TUTOR".equals(item.getSubmittedByRole())));
        assertEquals(SettlementStatus.DISPUTE_OPENING,
                sessionSettlementRepository.findById(settlement.getId()).orElseThrow().getStatus());
        verifyNoInteractions(notificationDispatcher);
    }

    @Test
    void studentCanOpenDisputeWithoutOptionalEvidence() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertAgreement(agreementId, onchainAgreementId, Hash.sha3String("terms-v1"),
                "ACTIVE", 1, "staff1@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, Hash.sha3String("EDUCONNECT:SESSION:1"), SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(20), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        workflowService.initiateDisputeOpening(
                settlement.getId(), 101L, "STUDENT", "Tutor was absent", "0x" + "c".repeat(64),
                null, null, null);

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        assertEquals("Tutor was absent", dispute.getReason());
        assertTrue(disputeEvidenceRepository.findByDisputeId(dispute.getId()).isEmpty());
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
                "STUDENT",
                "Tutor did not teach the recorded session",
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
                "STUDENT",
                "Tutor did not teach the recorded session",
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
                settlement.getId(), 101L, "STUDENT", "Tutor did not teach the recorded session",
                "0x" + "c".repeat(64), "obj_key", "application/pdf", "sha256");

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

        Dispute responded = workflowService.submitTutorResponse(
                dispute.getId(), 102L, "I joined the class and attached my evidence", "https://evidence.test/tutor.png");
        assertEquals("I joined the class and attached my evidence", responded.getTutorResponse());
        assertNotNull(responded.getTutorRespondedAt());
        assertTrue(disputeEvidenceRepository.findByDisputeId(dispute.getId()).stream()
                .anyMatch(item -> "TUTOR".equals(item.getSubmittedByRole())
                        && "https://evidence.test/tutor.png".equals(item.getObjectKey())
                        && item.getSha256() != null
                        && item.getSha256().length() == 64));

        responded.setSubmittedAt(Instant.now().minus(DisputeWorkflowService.TUTOR_RESPONSE_WINDOW).minusSeconds(1));
        disputeRepository.saveAndFlush(responded);
        assertThrows(IllegalStateException.class, () -> workflowService.submitTutorResponse(
                dispute.getId(), 102L, "Late updated response", null));
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
                settlement.getId(), 101L, "STUDENT", "Tutor did not teach the recorded session",
                "0x" + "c".repeat(64), "obj_key", "application/pdf", "sha256");

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        dispute.markOpen("0x" + "d".repeat(64));
        disputeRepository.save(dispute);

        // 1. Wrong staff attempts resolution -> rejected
        assertThrows(SecurityException.class, () -> workflowService.initiateDisputeResolution(
                dispute.getId(), 202L, "wrong_staff@educonnect.com", "STAFF", true, "reason", "0x" + "f".repeat(64)));

        // 2. Even the assigned Staff must wait while the Tutor still has time to respond.
        assertThrows(IllegalStateException.class, () -> workflowService.initiateDisputeResolution(
                dispute.getId(), 201L, "staff_reviewer@educonnect.com", "STAFF", true, "reason", "0x" + "f".repeat(64)));

        // 3. Once the Tutor responds, the assigned Staff may resolve immediately.
        Dispute currentDispute = disputeRepository.findById(dispute.getId()).orElseThrow();
        currentDispute.setTutorResponse("Tutor response");
        currentDispute.setTutorRespondedAt(Instant.now());
        disputeRepository.save(currentDispute);
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
                settlement.getId(), 101L, "STUDENT", "Tutor did not teach the recorded session",
                "0x" + "c".repeat(64), "obj_key", "application/pdf", "sha256");

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        dispute.markOpen("0x" + "d".repeat(64));
        dispute.setSubmittedAt(Instant.now().minus(DisputeWorkflowService.TUTOR_RESPONSE_WINDOW).minusSeconds(1));
        disputeRepository.save(dispute);

        // ADMIN can resolve regardless of reviewer after the Tutor response window expires.
        BlockchainTransactionIntentResult adminResult = workflowService.initiateDisputeResolution(
                dispute.getId(), 999L, "admin@educonnect.com", "ADMIN", false, "admin reason", "0x" + "f".repeat(64));
        assertNotNull(adminResult);
        assertEquals("RESOLVE:" + CHAIN_ID + ":" + agreementId + ":1", adminResult.idempotencyKey());
    }

    @Test
    void resolutionRequiresMeaningfulAuditReason() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertAgreement(agreementId, onchainAgreementId, Hash.sha3String("terms-v1"),
                "ACTIVE", 1, "staff_reviewer@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, Hash.sha3String("EDUCONNECT:SESSION:1"), SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(12), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        workflowService.initiateDisputeOpening(
                settlement.getId(), 101L, "STUDENT", "Tutor did not teach the recorded session",
                "0x" + "c".repeat(64), null, null, null);
        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        dispute.markOpen("0x" + "d".repeat(64));
        dispute.setTutorResponse("Tutor response");
        dispute.setTutorRespondedAt(Instant.now());
        disputeRepository.save(dispute);

        assertThrows(IllegalArgumentException.class, () -> workflowService.initiateDisputeResolution(
                dispute.getId(), 999L, "admin@educonnect.com", "ADMIN", true,
                "   ", "0x" + "f".repeat(64)));
        assertEquals(DisputeStatus.OPEN, disputeRepository.findById(dispute.getId()).orElseThrow().getStatus());
    }

    @Test
    void processConfirmedDisputeResolvedEventMarksOnlyDisputeUntilSessionSettledEvent() throws Exception {
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
                settlement.getId(), 101L, "STUDENT", "Tutor did not teach the recorded session",
                "0x" + "c".repeat(64), "obj_key", "application/pdf", "sha256");

        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        dispute.markOpen("0x" + "d".repeat(64));
        dispute.setTutorResponse("Tutor response");
        dispute.setTutorRespondedAt(Instant.now());
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
        assertEquals(SettlementStatus.DISPUTE_OPENING, refundedSettlement.getStatus());

        ContractAgreement activeAgreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.ACTIVE, activeAgreement.getStatus());
    }

    @Test
    void tutorComplaintResolutionUsesTutorSemanticsAndDoesNotNotifyStudent() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertAgreement(agreementId, onchainAgreementId, Hash.sha3String("terms-v1"),
                "ACTIVE", 1, "staff_reviewer@educonnect.com");

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        String onchainSessionId = Hash.sha3String("EDUCONNECT:SESSION:1");
        SessionSettlement settlement = SessionSettlement.create(
                agreement, 1L, onchainSessionId, SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(100_000_000L), "0x" + "a".repeat(64));
        settlement.markProposed(OffsetDateTime.now(ZoneOffset.UTC).plusHours(12), "0x" + "b".repeat(64));
        sessionSettlementRepository.save(settlement);

        workflowService.initiateDisputeOpening(
                settlement.getId(), 102L, "TUTOR", "Student misconduct",
                "0x" + "c".repeat(64), null, null, null);
        Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElseThrow();
        dispute.markOpen("0x" + "d".repeat(64));
        disputeRepository.save(dispute);
        workflowService.initiateDisputeResolution(
                dispute.getId(), 201L, "staff_reviewer@educonnect.com", "STAFF",
                true, "Tutor evidence accepted", "0x" + "f".repeat(64));

        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("agreementId", onchainAgreementId);
        attributes.put("sessionId", onchainSessionId);
        // V1's on-chain flag is tutor-fraud-centric, so false maps to an
        // approved Tutor-originated complaint and the normal Tutor payout branch.
        attributes.put("complaintApproved", "false");
        attributes.put("resolutionHash", "0x" + "f".repeat(64));
        DecodedEscrowEvent decoded = new DecodedEscrowEvent(
                EscrowEventType.TUTOR_FRAUD_DISPUTE_RESOLVED,
                onchainAgreementId,
                onchainSessionId,
                attributes);
        BlockchainLog log = new BlockchainLog(
                ESCROW, List.of("0x" + "2".repeat(64)), "0x", 140L,
                "0x" + "e".repeat(64), "0x" + "9".repeat(64), 0L);
        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID, ESCROW, log, "TUTOR_FRAUD_DISPUTE_RESOLVED",
                objectMapper.writeValueAsString(decoded), OffsetDateTime.now(ZoneOffset.UTC));

        assertTrue(workflowService.processConfirmedDisputeResolvedEvent(event));
        assertEquals(DisputeStatus.APPROVED,
                disputeRepository.findById(dispute.getId()).orElseThrow().getStatus());
        verify(notificationDispatcher, times(1)).sendAsync(
                any(), any(), anyString(), anyString(), anyString(), anyString(), anyString());
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
        FundingTestEvidence.insert(jdbcTemplate, id);
    }
}
