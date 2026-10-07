package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EscrowEventType;
import iuh.fit.contract_service.document.ContractArtifactStorage;
import iuh.fit.contract_service.document.ContractDocxRenderer;
import iuh.fit.contract_service.document.DocumentConverter;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.EscrowPayment;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.ContractDocumentArtifactStatus;
import iuh.fit.contract_service.enums.EscrowPaymentStatus;
import iuh.fit.contract_service.repository.ContractDocumentArtifactRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.web3j.crypto.Hash;
import tools.jackson.databind.ObjectMapper;

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
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "contract.document.template-version=EDUCONNECT_HOP_DONG_TEMPLATE_V1_1_20260923",
        "contract.document.verification-base-url=http://localhost:5173/contracts/verify",
        "contract.document.platform-contact-address=EduConnect",
        "contract.document.platform-operator-name=EduConnect",
        "contract.document.platform-support-email=support@example.com"
})
class AgreementFundingWorkflowTest {

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private EscrowPaymentRepository escrowPaymentRepository;

    @Autowired
    private ContractDocumentArtifactRepository artifactRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ContractDocxRenderer renderer;

    @MockitoBean
    private DocumentConverter converter;

    @MockitoBean
    private ContractArtifactStorage storage;

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
        jdbcTemplate.execute("DELETE FROM contract_document_artifact");
        jdbcTemplate.execute("DELETE FROM dispute_evidence");
        jdbcTemplate.execute("DELETE FROM dispute");
        jdbcTemplate.execute("DELETE FROM session_settlement");
        jdbcTemplate.execute("DELETE FROM contract_acceptance");
        jdbcTemplate.execute("DELETE FROM escrow_payment");
        jdbcTemplate.execute("DELETE FROM contract_agreement");
    }

    @Test
    void recordPaymentSubmissionTransitionsToPaymentConfirmingAndRecordsTxHash() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");

        String txHash = "0x" + "a".repeat(64);
        fundingWorkflowService.recordPaymentSubmission(agreementId, txHash);

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.PAYMENT_CONFIRMING, agreement.getStatus());

        EscrowPayment payment = escrowPaymentRepository.findByAgreementId(agreementId).orElseThrow();
        assertEquals(EscrowPaymentStatus.CONFIRMING, payment.getStatus());
        assertEquals(txHash, payment.getFundTxHash());
    }

    @Test
    void recordPaymentSubmissionIsIdempotentForSameTxHash() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");

        String txHash = "0x" + "a".repeat(64);
        fundingWorkflowService.recordPaymentSubmission(agreementId, txHash);
        fundingWorkflowService.recordPaymentSubmission(agreementId, "0x" + "A".repeat(64));

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.PAYMENT_CONFIRMING, agreement.getStatus());

        long paymentCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM escrow_payment WHERE agreement_id = ?", Long.class, agreementId);
        assertEquals(1L, paymentCount);
    }

    @Test
    void recordPaymentSubmissionRejectsDifferentTxWhileConfirming() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");

        fundingWorkflowService.recordPaymentSubmission(agreementId, "0x" + "a".repeat(64));

        assertThrows(IllegalStateException.class,
                () -> fundingWorkflowService.recordPaymentSubmission(agreementId, "0x" + "b".repeat(64)));
    }

    @Test
    void recordPaymentSubmissionRejectsActiveAgreementRetry() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "ACTIVE");

        assertThrows(IllegalStateException.class,
                () -> fundingWorkflowService.recordPaymentSubmission(agreementId, "0x" + "a".repeat(64)));
    }

    @Test
    void recordPaymentSubmissionAcceptsMatchingHashWhenFundingEventWonTheRace() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");
        String txHash = "0x" + "f".repeat(64);

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");
        fundingWorkflowService.processConfirmedFundingEvent(
                fundedEvent(onchainAgreementId, STUDENT, "40000000"));

        ContractAgreement result = fundingWorkflowService.recordPaymentSubmission(agreementId, txHash);

        assertEquals(ContractAgreementStatus.ACTIVE, result.getStatus());
        assertEquals(txHash, escrowPaymentRepository.findByAgreementId(agreementId).orElseThrow().getFundTxHash());
    }

    @Test
    void recordPaymentSubmissionRejectsBeforeWaitingPayment() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "PREPARING_BLOCKCHAIN");

        assertThrows(IllegalStateException.class,
                () -> fundingWorkflowService.recordPaymentSubmission(agreementId, "0x" + "a".repeat(64)));
    }

    @Test
    void processConfirmedFundingEventTransitionsAgreementToActiveAndPaymentToLocked() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");

        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("student", STUDENT);
        attributes.put("amount", "40000000");

        DecodedEscrowEvent decodedEvent = new DecodedEscrowEvent(
                EscrowEventType.AGREEMENT_FUNDED,
                onchainAgreementId,
                null,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decodedEvent);
        String txHash = "0x" + "f".repeat(64);
        String blockHash = "0x" + "b".repeat(64);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                105L,
                blockHash,
                txHash,
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "AGREEMENT_FUNDED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        boolean processed = fundingWorkflowService.processConfirmedFundingEvent(event);

        assertTrue(processed);

        ContractAgreement updatedAgreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.ACTIVE, updatedAgreement.getStatus());

        EscrowPayment updatedPayment = escrowPaymentRepository.findByAgreementId(agreementId).orElseThrow();
        assertEquals(EscrowPaymentStatus.LOCKED, updatedPayment.getStatus());
        assertEquals(txHash, updatedPayment.getFundTxHash());
        assertEquals(105L, updatedPayment.getConfirmedBlockNumber());
        assertEquals(blockHash, updatedPayment.getConfirmedBlockHash());

        long outboxCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'contract.activated.v1'", Long.class);
        assertEquals(1L, outboxCount);
    }

    @Test
    void processConfirmedFundingEventFinalizesOfficialDocumentAfterCommit() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String termsJson = finalizableTermsJson();
        String termsHash = Hash.sha3String(termsJson);
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertFinalizableAgreement(agreementId, onchainAgreementId, termsHash, termsJson, "WAITING_PAYMENT");
        insertAcceptance(agreementId, 2L, "TUTOR", TUTOR, termsHash);
        insertAcceptance(agreementId, 1L, "STUDENT", STUDENT, termsHash);
        when(renderer.render(anyMap())).thenReturn(new byte[]{1, 2, 3});
        when(converter.docxToPdf(any(), any())).thenReturn("%PDF-1.7\nartifact".getBytes());

        assertTrue(fundingWorkflowService.processConfirmedFundingEvent(
                fundedEvent(onchainAgreementId, STUDENT, "40000000")));

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.ACTIVE, agreement.getStatus());
        var artifact = artifactRepository.findByAgreementIdAndContractVersion(agreementId, 1).orElseThrow();
        assertEquals(ContractDocumentArtifactStatus.READY, artifact.getStatus());
        assertEquals("contracts/" + agreementId + "/v1/final/contract.pdf", artifact.getPdfObjectKey());
        assertNotNull(artifact.getPdfSha256());
    }

    @Test
    void officialDocumentFailureDoesNotRollbackActivatedAgreement() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String termsJson = finalizableTermsJson();
        String termsHash = Hash.sha3String(termsJson);
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertFinalizableAgreement(agreementId, onchainAgreementId, termsHash, termsJson, "WAITING_PAYMENT");
        insertAcceptance(agreementId, 2L, "TUTOR", TUTOR, termsHash);
        insertAcceptance(agreementId, 1L, "STUDENT", STUDENT, termsHash);
        when(renderer.render(anyMap())).thenReturn(new byte[]{1, 2, 3});
        when(converter.docxToPdf(any(), any())).thenThrow(new IllegalStateException("converter unavailable"));

        assertTrue(fundingWorkflowService.processConfirmedFundingEvent(
                fundedEvent(onchainAgreementId, STUDENT, "40000000")));

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.ACTIVE, agreement.getStatus());
        var artifact = artifactRepository.findByAgreementIdAndContractVersion(agreementId, 1).orElseThrow();
        assertEquals(ContractDocumentArtifactStatus.FAILED, artifact.getStatus());
        assertEquals("CONTRACT_DOCUMENT_PDF_GENERATION_FAILED", artifact.getFailureCode());
    }

    @Test
    void duplicateFundingEventDoesNotCreateDuplicateOfficialDocumentArtifact() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String termsJson = finalizableTermsJson();
        String termsHash = Hash.sha3String(termsJson);
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertFinalizableAgreement(agreementId, onchainAgreementId, termsHash, termsJson, "WAITING_PAYMENT");
        insertAcceptance(agreementId, 2L, "TUTOR", TUTOR, termsHash);
        insertAcceptance(agreementId, 1L, "STUDENT", STUDENT, termsHash);
        when(renderer.render(anyMap())).thenReturn(new byte[]{1, 2, 3});
        when(converter.docxToPdf(any(), any())).thenReturn("%PDF-1.7\nartifact".getBytes());

        ProcessedEvent event = fundedEvent(onchainAgreementId, STUDENT, "40000000");
        assertTrue(fundingWorkflowService.processConfirmedFundingEvent(event));
        assertTrue(fundingWorkflowService.processConfirmedFundingEvent(event));

        long artifactCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM contract_document_artifact WHERE agreement_id = ?",
                Long.class,
                agreementId);
        assertEquals(1L, artifactCount);
    }

    @Test
    void processConfirmedFundingEventIsIdempotentAfterActivation() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");

        ProcessedEvent event = fundedEvent(onchainAgreementId, STUDENT, "40000000");

        assertTrue(fundingWorkflowService.processConfirmedFundingEvent(event));
        assertTrue(fundingWorkflowService.processConfirmedFundingEvent(event));

        ContractAgreement updatedAgreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.ACTIVE, updatedAgreement.getStatus());
        long outboxCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'contract.activated.v1'", Long.class);
        assertEquals(1L, outboxCount);
    }

    @Test
    void processConfirmedFundingEventForUnknownAgreementDoesNotActivateCurrentAgreement() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");

        ProcessedEvent event = fundedEvent(Hash.sha3String("other-agreement"), STUDENT, "40000000");

        boolean processed = fundingWorkflowService.processConfirmedFundingEvent(event);

        assertEquals(false, processed);
        ContractAgreement unchanged = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.WAITING_PAYMENT, unchanged.getStatus());
    }

    @Test
    void processConfirmedFundingEventFailsOnStudentMismatch() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");

        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("student", "0x0000000000000000000000000000000000000099"); // Wrong student!
        attributes.put("amount", "40000000");

        DecodedEscrowEvent decodedEvent = new DecodedEscrowEvent(
                EscrowEventType.AGREEMENT_FUNDED,
                onchainAgreementId,
                null,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decodedEvent);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                105L,
                "0x" + "b".repeat(64),
                "0x" + "f".repeat(64),
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "AGREEMENT_FUNDED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        assertThrows(IllegalStateException.class, () -> fundingWorkflowService.processConfirmedFundingEvent(event));
    }

    @Test
    void processConfirmedFundingEventFailsOnAmountMismatch() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "WAITING_PAYMENT");

        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("student", STUDENT);
        attributes.put("amount", "10000000"); // Wrong amount!

        DecodedEscrowEvent decodedEvent = new DecodedEscrowEvent(
                EscrowEventType.AGREEMENT_FUNDED,
                onchainAgreementId,
                null,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decodedEvent);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                105L,
                "0x" + "b".repeat(64),
                "0x" + "f".repeat(64),
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "AGREEMENT_FUNDED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        assertThrows(IllegalStateException.class, () -> fundingWorkflowService.processConfirmedFundingEvent(event));
    }

    private void insertAgreement(UUID id, String onchainAgreementId, String termsHash, String status) {
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
                    25000.00, 40000000, 4000000,
                    10, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, STUDENT, TUTOR, PLATFORM, CHAIN_ID,
                ESCROW, TOKEN, termsHash, status);
    }

    private void insertFinalizableAgreement(UUID id, String onchainAgreementId, String termsHash, String termsJson, String status) {
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at,
                    student_email, tutor_email, student_name, tutor_name, class_name,
                    student_phone, tutor_phone, payment_deadline
                ) VALUES (
                    ?, ?, 1, 1, 2,
                    ?, ?, ?, ?,
                    ?, ?, 'USDC', 6,
                    ?, ?, 1, 1000000.00,
                    25000.00, 40000000, 4000000,
                    10, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                    'student@example.com', 'tutor@example.com', 'Nguyen Van Student', 'Tran Van Tutor', 'Toan 12',
                    '0900000001', '0900000002', ?
                )
                """,
                id, onchainAgreementId, STUDENT, TUTOR, PLATFORM, CHAIN_ID,
                ESCROW, TOKEN, termsJson, termsHash, status, OffsetDateTime.now(ZoneOffset.UTC).plusDays(1));
    }

    private void insertAcceptance(UUID agreementId, Long userId, String role, String wallet, String termsHash) {
        jdbcTemplate.update("""
                INSERT INTO contract_acceptance (
                    id, agreement_id, user_id, role, wallet_address, accepted_at,
                    terms_hash, signature, contract_version
                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 1)
                """,
                UUID.randomUUID(), agreementId, userId, role, wallet, termsHash, "0x" + "a".repeat(130));
    }

    private String finalizableTermsJson() {
        return """
                {"schemaVersion":"v1","classroom":{"name":"Toan 12","description":"On thi THPT","learningMode":"ONLINE","meetingPlatform":"Google Meet","meetingLink":"https://meet.example/room","learningAddress":null,"startDate":"2026-09-01","endDate":"2026-10-01","durationPerSessionMinutes":60,"schedules":[{"dayOfWeek":2,"startTime":"18:00","endTime":"19:00"}],"syllabus":[]},"parties":{"tutor":{"fullName":"Tran Van Tutor","email":"tutor@example.com","phone":"0900000002","walletAddress":"0x0000000000000000000000000000000000000002","dateOfBirth":"1990-01-01","address":"TP. Ho Chi Minh"},"student":{"fullName":"Nguyen Van Student","email":"student@example.com","phone":"0900000001","walletAddress":"0x0000000000000000000000000000000000000001","dateOfBirth":"2005-01-01","address":"TP. Ho Chi Minh"}},"financial":{"pricePerSessionVnd":100000,"totalPriceVnd":1000000,"vndPerUsdc":25000,"tokenSymbol":"USDC","tokenDecimals":6,"pricePerSessionUsdcUnits":"4000000","totalAmountUsdcUnits":"40000000","totalSessions":10},"platform":{"chainId":31337,"platformWallet":"0x0000000000000000000000000000000000000003","escrowContractAddress":"0x0000000000000000000000000000000000000004","tokenAddress":"0x0000000000000000000000000000000000000005"},"escrowPolicy":{"paymentWindowHours":24,"tutorPayoutBps":8500,"platformFeeBps":1500,"settlementRule":"test policy"}}
                """.trim();
    }

    private ProcessedEvent fundedEvent(String onchainAgreementId, String student, String amount) throws Exception {
        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("student", student);
        attributes.put("amount", amount);

        DecodedEscrowEvent decodedEvent = new DecodedEscrowEvent(
                EscrowEventType.AGREEMENT_FUNDED,
                onchainAgreementId,
                null,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decodedEvent);
        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                105L,
                "0x" + "b".repeat(64),
                "0x" + "f".repeat(64),
                0L);

        return ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "AGREEMENT_FUNDED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));
    }
}
