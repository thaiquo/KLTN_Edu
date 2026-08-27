package iuh.fit.contract_service.migration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
class ContractSchemaMigrationTest {
    private static final String MAX_UINT256_DECIMAL =
            "115792089237316195423570985008687907853269984665640564039457584007913129639935";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void storesUint256SizedAmountsWithoutFloatingPointLoss() {
        UUID agreementId = UUID.randomUUID();
        insertAgreement(agreementId, 1001, 2001, 1, new BigDecimal(MAX_UINT256_DECIMAL));

        BigDecimal stored = jdbcTemplate.queryForObject(
                "SELECT total_amount_usdc_units FROM contract_agreement WHERE id = ?",
                BigDecimal.class,
                agreementId);

        assertEquals(new BigDecimal(MAX_UINT256_DECIMAL), stored);
    }

    @Test
    void rejectsDuplicateAgreementBusinessKey() {
        insertAgreement(UUID.randomUUID(), 1002, 2002, 1, BigDecimal.valueOf(40_000_000));

        assertThrows(DataIntegrityViolationException.class,
                () -> insertAgreement(UUID.randomUUID(), 1002, 2002, 1,
                        BigDecimal.valueOf(40_000_000)));
    }

    @Test
    void rejectsDuplicateBlockchainCommandIdempotencyKey() {
        String sql = """
                INSERT INTO blockchain_transaction (
                    id, idempotency_key, action, chain_id, from_address, to_address,
                    calldata_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        Object[] command = {
                UUID.randomUUID(), "REGISTER:31337:agreement-1", "REGISTER_AGREEMENT", 31_337L,
                "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
                "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
                "0x729fd3bac149a0c2bb6fa80f6f61a6cf6ad8abd63211178d47b396c088a04cec",
                "CREATED", OffsetDateTime.now(), OffsetDateTime.now()
        };
        jdbcTemplate.update(sql, command);
        command[0] = UUID.randomUUID();

        assertThrows(DataIntegrityViolationException.class,
                () -> jdbcTemplate.update(sql, command));
    }

    @Test
    void rejectsSameEventForSameConsumerButAllowsAnotherConsumer() {
        UUID eventId = UUID.randomUUID();
        insertProcessedEvent(UUID.randomUUID(), "contract-agreement-consumer", eventId);

        assertThrows(DataIntegrityViolationException.class,
                () -> insertProcessedEvent(UUID.randomUUID(), "contract-agreement-consumer", eventId));

        insertProcessedEvent(UUID.randomUUID(), "notification-consumer", eventId);
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId);
        assertEquals(2, count);
    }

    private void insertAgreement(UUID id, long classroomId, long studentId, int version, BigDecimal amount) {
        jdbcTemplate.update("""
                        INSERT INTO contract_agreement (
                            id, classroom_id, student_id, tutor_id, classroom_reviewer_email,
                            student_wallet, tutor_wallet, platform_wallet, terms_json, terms_hash,
                            contract_version, total_price_vnd, vnd_per_usdc,
                            total_amount_usdc_units, price_per_session_usdc_units,
                            total_sessions, status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                id, classroomId, studentId, 3001L, "staff@educonnect.test",
                "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
                "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
                "{}", "0x729fd3bac149a0c2bb6fa80f6f61a6cf6ad8abd63211178d47b396c088a04cec",
                version, BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(25_000),
                amount, BigDecimal.ONE, 10, "DRAFT", OffsetDateTime.now(), OffsetDateTime.now());
    }

    private void insertProcessedEvent(UUID id, String consumer, UUID eventId) {
        jdbcTemplate.update("""
                        INSERT INTO processed_event (id, consumer_name, event_id, event_type, processed_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                id, consumer, eventId, "enrollment.request.accepted.v1", OffsetDateTime.now());
    }
}
