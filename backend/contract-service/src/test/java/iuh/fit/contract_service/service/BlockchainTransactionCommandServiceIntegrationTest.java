package iuh.fit.contract_service.service;

import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.command.IdempotencyConflictException;
import iuh.fit.contract_service.enums.BlockchainTransactionAction;
import iuh.fit.contract_service.enums.BlockchainTransactionStatus;
import iuh.fit.contract_service.outbox.BlockchainTransactionOutboxFactory;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.web3j.crypto.Hash;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest
class BlockchainTransactionCommandServiceIntegrationTest {
    private static final String FROM = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    private static final String TO = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
    private static final String CALLDATA = "0x1234";
    private static final String CALLDATA_HASH = Hash.sha3(CALLDATA);

    @Autowired
    private BlockchainTransactionCommandService service;

    @Autowired
    private BlockchainTransactionRepository transactionRepository;

    @Autowired
    private OutboxEventRepository outboxRepository;

    @Autowired
    private BlockchainTransactionOutboxFactory outboxFactory;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private UUID agreementId;

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
        agreementId = UUID.randomUUID();
        insertAgreement(agreementId);
    }

    @Test
    void createsOneDurableIntentAndOneOutboxEvent() {
        BlockchainTransactionIntentResult result = service.createIntent(command(CALLDATA));

        assertTrue(result.created());
        assertEquals(BlockchainTransactionStatus.CREATED, result.status());
        assertEquals(1, transactionRepository.count());
        assertEquals(1, outboxRepository.count());
        var storedTransaction = transactionRepository.findById(result.transactionId()).orElseThrow();
        assertNull(storedTransaction.getTransactionHash());
        assertNull(storedTransaction.getNonce());
        assertEquals(0, storedTransaction.getAttemptCount());
        assertTrue(outboxRepository.findAll().getFirst().getPayload().contains(result.idempotencyKey()));
        assertEquals(0, outboxRepository.findAll().getFirst().getAttemptCount());
    }

    @Test
    void repeatedIdenticalCommandReturnsExistingIntentWithoutSecondOutboxEvent() {
        BlockchainTransactionIntentResult first = service.createIntent(command(CALLDATA));
        BlockchainTransactionIntentResult second = service.createIntent(command(CALLDATA));

        assertTrue(first.created());
        assertFalse(second.created());
        assertEquals(first.transactionId(), second.transactionId());
        assertEquals(1, transactionRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void sameKeyWithDifferentPayloadIsRejectedAsConflict() {
        service.createIntent(command(CALLDATA));

        assertThrows(IdempotencyConflictException.class,
                () -> service.createIntent(command("0xabcd")));
        assertEquals(1, transactionRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void concurrentDuplicatesConvergeToOneIntent() throws Exception {
        int callers = 4;
        CountDownLatch ready = new CountDownLatch(callers);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(callers)) {
            List<Future<BlockchainTransactionIntentResult>> futures = new ArrayList<>();
            for (int index = 0; index < callers; index++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return service.createIntent(command(CALLDATA));
                }));
            }
            ready.await();
            start.countDown();

            UUID transactionId = futures.getFirst().get().transactionId();
            for (Future<BlockchainTransactionIntentResult> future : futures) {
                assertEquals(transactionId, future.get().transactionId());
            }
        }
        assertEquals(1, transactionRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void rollsBackTransactionIntentWhenOutboxCreationFails() {
        BlockchainTransactionOutboxFactory failingFactory = mock(BlockchainTransactionOutboxFactory.class);
        when(failingFactory.createIntentCreatedEvent(any(), any(), any()))
                .thenThrow(new IllegalStateException("serialization failed"));
        BlockchainTransactionCommandService failingService = new BlockchainTransactionCommandService(
                transactionRepository,
                outboxRepository,
                failingFactory,
                transactionManager);

        assertThrows(IllegalStateException.class,
                () -> failingService.createIntent(command(CALLDATA)));
        assertEquals(0, transactionRepository.count());
        assertEquals(0, outboxRepository.count());
    }

    private BlockchainTransactionCommand command(String calldata) {
        return new BlockchainTransactionCommand(
                "REGISTER:31337:" + agreementId,
                BlockchainTransactionAction.REGISTER,
                31_337,
                FROM,
                TO,
                calldata,
                Hash.sha3(calldata),
                agreementId,
                null,
                agreementId.toString());
    }

    private void insertAgreement(UUID id) {
        jdbcTemplate.update("""
                        INSERT INTO contract_agreement (
                            id, classroom_id, student_id, tutor_id, classroom_reviewer_email,
                            student_wallet, tutor_wallet, platform_wallet, terms_json, terms_hash,
                            contract_version, total_price_vnd, vnd_per_usdc,
                            total_amount_usdc_units, price_per_session_usdc_units,
                            total_sessions, status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                id, Math.abs(id.getMostSignificantBits()), Math.abs(id.getLeastSignificantBits()), 3001L,
                "staff@educonnect.test",
                "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
                FROM, "{}", CALLDATA_HASH, 1,
                BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(25_000),
                BigDecimal.valueOf(40_000_000), BigDecimal.valueOf(4_000_000),
                10, "PENDING_REGISTRATION", OffsetDateTime.now(), OffsetDateTime.now());
    }
}
