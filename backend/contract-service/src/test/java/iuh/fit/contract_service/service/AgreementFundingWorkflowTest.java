package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EscrowEventType;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.EscrowPayment;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.EscrowPaymentStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
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

@SpringBootTest
class AgreementFundingWorkflowTest {

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private EscrowPaymentRepository escrowPaymentRepository;

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
}
