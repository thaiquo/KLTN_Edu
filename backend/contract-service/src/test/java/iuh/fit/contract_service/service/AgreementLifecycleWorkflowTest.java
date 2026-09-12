package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EscrowEventType;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
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
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class AgreementLifecycleWorkflowTest {
    private static final long CHAIN_ID = 31_337L;
    private static final String ESCROW = "0x1234567890123456789012345678901234567890";

    @Autowired
    private AgreementLifecycleWorkflowService workflowService;
    @Autowired
    private ContractAgreementRepository agreementRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM outbox_event");
        jdbcTemplate.update("DELETE FROM blockchain_transaction");
        jdbcTemplate.update("DELETE FROM processed_event");
        jdbcTemplate.update("DELETE FROM dispute_evidence");
        jdbcTemplate.update("DELETE FROM dispute");
        jdbcTemplate.update("DELETE FROM session_settlement");
        jdbcTemplate.update("DELETE FROM escrow_payment");
        jdbcTemplate.update("DELETE FROM contract_agreement");
    }

    @Test
    void initiateExpirationCreatesDurableCommandWithoutChangingAgreementStatus() {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertAgreement(agreementId, onchainAgreementId, "WAITING_PAYMENT",
                OffsetDateTime.now(ZoneOffset.UTC).minusHours(1));

        BlockchainTransactionIntentResult result = workflowService.initiateExpiration(agreementId);

        assertTrue(result.created());
        assertEquals("EXPIRE:" + CHAIN_ID + ":" + agreementId, result.idempotencyKey());
        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.WAITING_PAYMENT, agreement.getStatus());
    }

    @Test
    void processCompletedEventTransitionsAgreementAfterConfirmedEvent() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertAgreement(agreementId, onchainAgreementId, "ACTIVE", null);

        boolean processed = workflowService.processCompletedEvent(event(
                EscrowEventType.AGREEMENT_COMPLETED, "AGREEMENT_COMPLETED", onchainAgreementId, Map.of()));

        assertTrue(processed);
        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.COMPLETED, agreement.getStatus());
        Long outboxCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'contract.completed.v1'", Long.class);
        assertEquals(1L, outboxCount);
    }

    @Test
    void processCancelledAndUnusedRefundedEventsAreIdempotentBusinessRecords() throws Exception {
        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
        insertAgreement(agreementId, onchainAgreementId, "ACTIVE", null);

        Map<String, String> cancelAttrs = new LinkedHashMap<>();
        cancelAttrs.put("reasonHash", "0x" + "a".repeat(64));
        assertTrue(workflowService.processCancelledEvent(event(
                EscrowEventType.AGREEMENT_CANCELLED, "AGREEMENT_CANCELLED", onchainAgreementId, cancelAttrs)));

        Map<String, String> refundAttrs = new LinkedHashMap<>();
        refundAttrs.put("student", "0x1111111111111111111111111111111111111111");
        refundAttrs.put("amount", "40000000");
        assertTrue(workflowService.processUnusedAmountRefundedEvent(event(
                EscrowEventType.UNUSED_AMOUNT_REFUNDED, "UNUSED_AMOUNT_REFUNDED", onchainAgreementId, refundAttrs)));

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.CANCELLED, agreement.getStatus());
        Long refundOutboxCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'contract.unused_refunded.v1'", Long.class);
        assertEquals(1L, refundOutboxCount);
    }

    private ProcessedEvent event(
            EscrowEventType type,
            String eventType,
            String onchainAgreementId,
            Map<String, String> attributes) throws Exception {
        DecodedEscrowEvent decoded = new DecodedEscrowEvent(type, onchainAgreementId, null, attributes);
        BlockchainLog log = new BlockchainLog(
                ESCROW,
                List.of("0x" + "1".repeat(64)),
                "0x",
                120L,
                "0x" + "b".repeat(64),
                "0x" + "f".repeat(64),
                0L);
        return ProcessedEvent.blockchainLog(
                CHAIN_ID,
                ESCROW,
                log,
                eventType,
                objectMapper.writeValueAsString(decoded),
                OffsetDateTime.now(ZoneOffset.UTC));
    }

    private void insertAgreement(
            UUID id,
            String onchainAgreementId,
            String status,
            OffsetDateTime paymentDeadline) {
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    classroom_reviewer_email, student_email, tutor_email,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, payment_deadline, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, 1001, 101, 102,
                    'staff@educonnect.com', 'student@educonnect.com', 'tutor@educonnect.com',
                    '0x1111111111111111111111111111111111111111',
                    '0x2222222222222222222222222222222222222222',
                    '0x3333333333333333333333333333333333333333',
                    ?, ?, '0x4444444444444444444444444444444444444444', 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 40000000,
                    1, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id,
                onchainAgreementId,
                CHAIN_ID,
                ESCROW,
                Hash.sha3String("terms-v1"),
                paymentDeadline,
                status);
        FundingTestEvidence.insert(jdbcTemplate, id);
    }
}
