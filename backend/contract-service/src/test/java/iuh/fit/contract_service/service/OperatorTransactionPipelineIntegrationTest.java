package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainTransactionReceipt;
import iuh.fit.contract_service.blockchain.OperatorTransactionException;
import iuh.fit.contract_service.blockchain.OperatorTransactionGateway;
import iuh.fit.contract_service.blockchain.PreparedOperatorTransaction;
import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.enums.BlockchainTransactionAction;
import iuh.fit.contract_service.enums.BlockchainTransactionStatus;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.web3j.crypto.Hash;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class OperatorTransactionPipelineIntegrationTest {
    private static final String FROM = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    private static final String TO = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
    private static final String CALLDATA = "0x1234";
    private static final String TX_HASH = "0x" + "ab".repeat(32);
    private static final String BLOCK_HASH = "0x" + "cd".repeat(32);

    @Autowired
    private BlockchainTransactionCommandService commandService;

    @Autowired
    private BlockchainTransactionRepository repository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private BlockchainProperties blockchainProperties;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private FakeOperatorGateway gateway;
    private OperatorTransactionDispatcher dispatcher;
    private BlockchainReceiptWatcher watcher;
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
        insertAgreement();
        blockchainProperties.setConfirmations(1);
        gateway = new FakeOperatorGateway();
        dispatcher = new OperatorTransactionDispatcher(repository, gateway, transactionManager);
        watcher = new BlockchainReceiptWatcher(
                repository, gateway, blockchainProperties, transactionManager);
    }

    @Test
    void claimsAndBroadcastsCreatedIntentOnlyOnce() {
        UUID transactionId = createIntent();

        assertEquals(Optional.of(transactionId), dispatcher.dispatchNext());
        assertTrue(dispatcher.dispatchNext().isEmpty());

        var stored = repository.findById(transactionId).orElseThrow();
        assertEquals(BlockchainTransactionStatus.SUBMITTED, stored.getStatus());
        assertEquals(BigInteger.valueOf(7), stored.getNonce());
        assertEquals(TX_HASH, stored.getTransactionHash());
        assertEquals(1, stored.getAttemptCount());
        assertEquals(1, gateway.prepareCalls);
        assertEquals(1, gateway.broadcastCalls);
    }

    @Test
    void rpcTimeoutStaysDispatchingAndReceiptReconciliationPreventsBlindResend() {
        UUID transactionId = createIntent();
        gateway.broadcastUncertain = true;

        dispatcher.dispatchNext();
        assertTrue(dispatcher.dispatchNext().isEmpty());

        var uncertain = repository.findById(transactionId).orElseThrow();
        assertEquals(BlockchainTransactionStatus.DISPATCHING, uncertain.getStatus());
        assertEquals(TX_HASH, uncertain.getTransactionHash());
        assertEquals(1, gateway.broadcastCalls);

        assertEquals(0, watcher.reconcilePendingReceipts());
        gateway.receipt = new BlockchainTransactionReceipt(TX_HASH, true, 100, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(100);

        assertEquals(1, watcher.reconcilePendingReceipts());
        var confirmed = repository.findById(transactionId).orElseThrow();
        assertEquals(BlockchainTransactionStatus.CONFIRMED, confirmed.getStatus());
        assertEquals((short) 1, confirmed.getReceiptStatus());
        assertEquals(100L, confirmed.getBlockNumber());
        assertNull(confirmed.getSignedRawTransaction());
        assertEquals(1, gateway.broadcastCalls);
    }

    @Test
    void waitsForConfiguredConfirmationCount() {
        UUID transactionId = createIntent();
        blockchainProperties.setConfirmations(2);
        dispatcher.dispatchNext();
        gateway.receipt = new BlockchainTransactionReceipt(TX_HASH, true, 100, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(100);

        assertEquals(0, watcher.reconcilePendingReceipts());
        assertEquals(BlockchainTransactionStatus.SUBMITTED,
                repository.findById(transactionId).orElseThrow().getStatus());

        gateway.latestBlock = BigInteger.valueOf(101);
        assertEquals(1, watcher.reconcilePendingReceipts());
        assertEquals(BlockchainTransactionStatus.CONFIRMED,
                repository.findById(transactionId).orElseThrow().getStatus());
    }

    @Test
    void recordsRevertedReceiptAsFailed() {
        UUID transactionId = createIntent();
        dispatcher.dispatchNext();
        gateway.receipt = new BlockchainTransactionReceipt(TX_HASH, false, 100, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(100);

        assertEquals(1, watcher.reconcilePendingReceipts());

        var failed = repository.findById(transactionId).orElseThrow();
        assertEquals(BlockchainTransactionStatus.FAILED, failed.getStatus());
        assertEquals((short) 0, failed.getReceiptStatus());
        assertEquals("On-chain transaction reverted", failed.getErrorMessage());
    }

    private UUID createIntent() {
        return commandService.createIntent(new BlockchainTransactionCommand(
                "REGISTER:31337:" + agreementId,
                BlockchainTransactionAction.REGISTER,
                31_337,
                FROM,
                TO,
                CALLDATA,
                Hash.sha3(CALLDATA),
                agreementId,
                null,
                agreementId.toString())).transactionId();
    }

    private void insertAgreement() {
        jdbcTemplate.update("""
                        INSERT INTO contract_agreement (
                            id, classroom_id, student_id, tutor_id, classroom_reviewer_email,
                            student_wallet, tutor_wallet, platform_wallet, terms_json, terms_hash,
                            contract_version, total_price_vnd, vnd_per_usdc,
                            total_amount_usdc_units, price_per_session_usdc_units,
                            total_sessions, status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                agreementId, Math.abs(agreementId.getMostSignificantBits()),
                Math.abs(agreementId.getLeastSignificantBits()), 3001L,
                "staff@educonnect.test",
                "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
                FROM, "{}", "0x" + "11".repeat(32), 1,
                BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(25_000),
                BigDecimal.valueOf(40_000_000), BigDecimal.valueOf(4_000_000),
                10, "PENDING_REGISTRATION", OffsetDateTime.now(), OffsetDateTime.now());
    }

    private static final class FakeOperatorGateway implements OperatorTransactionGateway {
        private int prepareCalls;
        private int broadcastCalls;
        private boolean broadcastUncertain;
        private BlockchainTransactionReceipt receipt;
        private BigInteger latestBlock = BigInteger.ZERO;

        @Override
        public PreparedOperatorTransaction prepare(
                long chainId, String fromAddress, String toAddress, String calldata) {
            prepareCalls++;
            return new PreparedOperatorTransaction(BigInteger.valueOf(7), TX_HASH, "0xdeadbeef");
        }

        @Override
        public String broadcast(PreparedOperatorTransaction transaction) {
            broadcastCalls++;
            if (broadcastUncertain) {
                throw new OperatorTransactionException("simulated RPC timeout");
            }
            return TX_HASH;
        }

        @Override
        public Optional<BlockchainTransactionReceipt> findReceipt(String transactionHash) {
            return Optional.ofNullable(receipt);
        }

        @Override
        public BigInteger latestBlockNumber() {
            return latestBlock;
        }
    }
}
