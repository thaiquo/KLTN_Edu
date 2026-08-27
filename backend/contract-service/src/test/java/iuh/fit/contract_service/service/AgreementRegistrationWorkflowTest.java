package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EscrowEventType;

import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.entity.ProcessedEvent;

import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import org.web3j.crypto.Hash;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
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
class AgreementRegistrationWorkflowTest {

    @Autowired
    private AgreementRegistrationWorkflowService workflowService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private static final long CHAIN_ID = 31337L;
    private static final String ESCROW = "0x0000000000000000000000000000000000000004";
    private static final String PLATFORM = "0x0000000000000000000000000000000000000003";
    private static final String STUDENT = "0x0000000000000000000000000000000000000001";
    private static final String TUTOR = "0x0000000000000000000000000000000000000002";

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
    void initiateRegistrationCreatesTransactionIntent() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "PREPARING_BLOCKCHAIN");

        BlockchainTransactionIntentResult result = workflowService.initiateRegistration(agreementId);

        assertNotNull(result);
        assertTrue(result.created());
        assertEquals("REGISTER:" + CHAIN_ID + ":" + agreementId, result.idempotencyKey());
    }

    @Test
    void initiateRegistrationFailsWhenStatusNotPreparingBlockchain() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "DRAFT");

        assertThrows(IllegalStateException.class, () -> workflowService.initiateRegistration(agreementId));
    }

    @Test
    void processConfirmedRegistrationEventTransitionsAgreementToWaitingPayment() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "PREPARING_BLOCKCHAIN");

        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("student", STUDENT);
        attributes.put("tutor", TUTOR);
        attributes.put("termsHash", termsHash);
        attributes.put("totalAmount", "40000000");
        attributes.put("pricePerSession", "4000000");
        attributes.put("totalSessions", "10");
        attributes.put("paymentDeadline", "1780000000");

        DecodedEscrowEvent decodedEvent = new DecodedEscrowEvent(
                EscrowEventType.AGREEMENT_REGISTERED,
                onchainAgreementId,
                null,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decodedEvent);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                100L,
                "0x" + "2".repeat(64),
                "0x" + "3".repeat(64),
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "AGREEMENT_REGISTERED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        boolean processed = workflowService.processConfirmedRegistrationEvent(event);

        assertTrue(processed);

        ContractAgreement updated = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.WAITING_PAYMENT, updated.getStatus());
        assertNotNull(updated.getPaymentDeadline());

        long outboxCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'contract.waiting_payment.v1'", Long.class);
        assertEquals(1L, outboxCount);
    }

    @Test
    void processConfirmedRegistrationEventFailsOnAttributeMismatch() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        String termsHash = Hash.sha3String("terms-v1");

        insertAgreement(agreementId, onchainAgreementId, termsHash, "PREPARING_BLOCKCHAIN");

        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("student", STUDENT);
        attributes.put("tutor", TUTOR);
        attributes.put("termsHash", termsHash);
        attributes.put("totalAmount", "50000000"); // Wrong amount!
        attributes.put("pricePerSession", "4000000");
        attributes.put("totalSessions", "10");
        attributes.put("paymentDeadline", "1780000000");

        DecodedEscrowEvent decodedEvent = new DecodedEscrowEvent(
                EscrowEventType.AGREEMENT_REGISTERED,
                onchainAgreementId,
                null,
                attributes);

        String jsonPayload = objectMapper.writeValueAsString(decodedEvent);

        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                100L,
                "0x" + "2".repeat(64),
                "0x" + "3".repeat(64),
                0L);

        ProcessedEvent event = ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                "AGREEMENT_REGISTERED",
                jsonPayload,
                OffsetDateTime.now(ZoneOffset.UTC));

        assertThrows(IllegalStateException.class, () -> workflowService.processConfirmedRegistrationEvent(event));
    }

    private void insertAgreement(UUID id, String onchainAgreementId, String termsHash, String status) {
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, 1, 1, 2,
                    ?, ?, ?, ?,
                    ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 4000000,
                    10, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, STUDENT, TUTOR, PLATFORM, CHAIN_ID,
                ESCROW, termsHash, status);
    }
}
