package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainTransactionReceipt;
import iuh.fit.contract_service.blockchain.OperatorTransactionException;
import iuh.fit.contract_service.blockchain.OperatorTransactionGateway;
import iuh.fit.contract_service.blockchain.PreparedOperatorTransaction;
import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.enums.BlockchainTransactionAction;
import iuh.fit.contract_service.enums.BlockchainTransactionStatus;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.web3j.crypto.Hash;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class OperatorTransactionPipelineIntegrationTest {
    @Autowired private OperationalFundingPolicy fundingPolicy;
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
        blockchainProperties.setDispatchRetryDelayMs(30_000);
        blockchainProperties.setMaxDispatchAttempts(3);
        blockchainProperties.setReceiptWatchBatchSize(50);
        blockchainProperties.setTransactionStaleTimeoutMs(1_800_000);
        gateway = new FakeOperatorGateway();
        dispatcher = new OperatorTransactionDispatcher(repository, gateway, blockchainProperties, transactionManager, fundingPolicy);
        watcher = new BlockchainReceiptWatcher(
                repository, gateway, blockchainProperties, transactionManager);
    }

    @AfterEach
    void resetProperties() {
        blockchainProperties.setConfirmations(1);
        blockchainProperties.setDispatchRetryDelayMs(30_000);
        blockchainProperties.setMaxDispatchAttempts(3);
        blockchainProperties.setReceiptWatchBatchSize(50);
        blockchainProperties.setTransactionStaleTimeoutMs(1_800_000);
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

    @Test
    void revertedReceiptMustReachConfirmationsAndCanDisappearBeforeThen() {
        UUID id = createIntent();
        blockchainProperties.setConfirmations(3);
        dispatcher.dispatchNext();
        gateway.receipt = new BlockchainTransactionReceipt(TX_HASH, false, 100, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(100);
        assertEquals(0, watcher.reconcilePendingReceipts());
        var pending = repository.findById(id).orElseThrow();
        assertEquals(BlockchainTransactionStatus.SUBMITTED, pending.getStatus());
        assertNull(pending.getReceiptStatus());
        assertEquals("0xdeadbeef", pending.getSignedRawTransaction());
        gateway.receipt = null;
        assertEquals(0, watcher.reconcilePendingReceipts());
        gateway.receipt = new BlockchainTransactionReceipt(TX_HASH, false, 101, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(103);
        assertEquals(1, watcher.reconcilePendingReceipts());
        assertEquals(BlockchainTransactionStatus.FAILED, repository.findById(id).orElseThrow().getStatus());
    }

    @Test
    void submittedTransactionReservesSenderUntilReceiptIsConfirmed() {
        createIntent();
        dispatcher.dispatchNext();
        var queued = repository.saveAndFlush(BlockchainTransaction.createIntent("queued-register", "REGISTER",
                31337, FROM.toUpperCase(), TO, CALLDATA, Hash.sha3(CALLDATA), agreementId, null, OffsetDateTime.now()));
        assertTrue(dispatcher.dispatchNext().isEmpty());
        assertEquals(1, gateway.prepareCalls);
        gateway.receipt = new BlockchainTransactionReceipt(TX_HASH, true, 100, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(100);
        watcher.reconcilePendingReceipts();
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                assertEquals(queued.getId(), repository.lockCreatedForDispatch(OffsetDateTime.now(),
                        PageRequest.of(0, 1)).getFirst().getId()));
    }

    @Test
    void droppedSubmittedTransactionRebroadcastsSameBytesWithBackoff() {
        UUID id = createIntent();
        dispatcher.dispatchNext();
        jdbcTemplate.update("UPDATE blockchain_transaction SET dispatch_started_at = ? WHERE id = ?",
                OffsetDateTime.now().minusHours(1), id);
        watcher.reconcilePendingReceipts();
        assertEquals(2, gateway.broadcastCalls);
        assertEquals(1, gateway.prepareCalls);
        assertEquals("0xdeadbeef", gateway.lastBroadcast.signedRawTransaction());
        assertEquals(BigInteger.valueOf(7), gateway.lastBroadcast.nonce());
        watcher.reconcilePendingReceipts();
        assertEquals(2, gateway.broadcastCalls);
        assertEquals(TX_HASH, repository.findById(id).orElseThrow().getTransactionHash());
    }

    @Test
    void failingRpcReceiptDoesNotStarveTheNextBatch() {
        UUID first = createIntent();
        dispatcher.dispatchNext();
        jdbcTemplate.update("UPDATE blockchain_transaction SET updated_at = ? WHERE id = ?",
                OffsetDateTime.now().minusMinutes(2), first);
        String secondHash = "0x" + "ee".repeat(32);
        var second = BlockchainTransaction.createIntent("other-pending", "REGISTER", 31337,
                FROM, TO, CALLDATA, Hash.sha3(CALLDATA), agreementId, null, OffsetDateTime.now().minusMinutes(1));
        second.claimForDispatch(OffsetDateTime.now().minusMinutes(1));
        second.recordPreparedTransaction(BigInteger.valueOf(8), secondHash, "0xbeef", OffsetDateTime.now().minusMinutes(1));
        second.markSubmitted(secondHash, OffsetDateTime.now().minusMinutes(1));
        repository.saveAndFlush(second);
        gateway.failingReceiptHash = TX_HASH;
        gateway.receipt = new BlockchainTransactionReceipt(secondHash, true, 100, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(100);
        assertEquals(0, watcher.reconcilePendingReceipts(1));
        assertEquals(1, watcher.reconcilePendingReceipts(1));
        assertEquals(BlockchainTransactionStatus.CONFIRMED, repository.findById(second.getId()).orElseThrow().getStatus());
        assertEquals(BlockchainTransactionStatus.SUBMITTED, repository.findById(first).orElseThrow().getStatus());
    }

    @Test
    void delayedReceiptRemainsWatchedAndCanConfirmAfterStaleTimeout() {
        UUID id = createIntent();
        dispatcher.dispatchNext();
        jdbcTemplate.update("UPDATE blockchain_transaction SET dispatch_started_at = ? WHERE id = ?",
                OffsetDateTime.now().minusHours(1), id);
        watcher.reconcilePendingReceipts();
        var delayed = repository.findById(id).orElseThrow();
        assertEquals(BlockchainTransactionStatus.SUBMITTED, delayed.getStatus());
        assertEquals(TX_HASH, delayed.getTransactionHash());
        gateway.receipt = new BlockchainTransactionReceipt(TX_HASH, true, 100, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(100);
        watcher.reconcilePendingReceipts();
        assertEquals(BlockchainTransactionStatus.CONFIRMED, repository.findById(id).orElseThrow().getStatus());
        assertEquals(1, gateway.prepareCalls);
    }

    @Test
    void uncertainBroadcastResendsExactlyThePreparedTransactionWithoutNewNonce() {
        UUID id = createIntent();
        gateway.broadcastUncertain = true;
        dispatcher.dispatchNext();
        jdbcTemplate.update("UPDATE blockchain_transaction SET next_attempt_at = ? WHERE id = ?",
                OffsetDateTime.now().minusMinutes(1), id);
        gateway.broadcastUncertain = false;
        watcher.reconcilePendingReceipts();
        var recovered = repository.findById(id).orElseThrow();
        assertEquals(BlockchainTransactionStatus.SUBMITTED, recovered.getStatus());
        assertEquals(TX_HASH, recovered.getTransactionHash());
        assertEquals(1, gateway.prepareCalls);
        assertEquals(2, gateway.broadcastCalls);
    }

    @Test
    void preparationFailureReturnsIntentToCreatedForBoundedRetry() {
        UUID transactionId = createIntent();
        gateway.prepareFails = true;
        blockchainProperties.setDispatchRetryDelayMs(1);

        assertThrows(OperatorTransactionException.class, () -> dispatcher.dispatchNext());

        var retryable = repository.findById(transactionId).orElseThrow();
        assertEquals(BlockchainTransactionStatus.CREATED, retryable.getStatus());
        assertEquals(1, retryable.getAttemptCount());
        assertTrue(retryable.getNextAttemptAt() != null);
        assertEquals(1, gateway.prepareCalls);
        assertEquals(0, gateway.broadcastCalls);
    }

    @Test
    void staleUnpreparedDispatchIsRecoveredAfterRestart() {
        UUID transactionId = createIntent();
        OffsetDateTime staleStartedAt = OffsetDateTime.now().minusMinutes(31);

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            BlockchainTransaction transaction = repository
                    .lockCreatedForDispatch(OffsetDateTime.now(), PageRequest.of(0, 1))
                    .stream()
                    .findFirst()
                    .orElseThrow();
            transaction.claimForDispatch(staleStartedAt);
            repository.saveAndFlush(transaction);
        });

        assertEquals(1, watcher.reconcilePendingReceipts());

        var recovered = repository.findById(transactionId).orElseThrow();
        assertEquals(BlockchainTransactionStatus.CREATED, recovered.getStatus());
        assertEquals(1, recovered.getAttemptCount());
        assertNull(recovered.getTransactionHash());
        assertTrue(recovered.getNextAttemptAt() != null);
    }

    @Test
    void confirmedReceiptDoesNotAdvanceAgreementWithoutContractEvent() {
        UUID transactionId = createIntent();
        dispatcher.dispatchNext();
        gateway.receipt = new BlockchainTransactionReceipt(TX_HASH, true, 100, BLOCK_HASH);
        gateway.latestBlock = BigInteger.valueOf(100);

        assertEquals(1, watcher.reconcilePendingReceipts());

        assertEquals(BlockchainTransactionStatus.CONFIRMED,
                repository.findById(transactionId).orElseThrow().getStatus());
        String agreementStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM contract_agreement WHERE id = ?",
                String.class,
                agreementId);
        assertEquals(ContractAgreementStatus.PREPARING_BLOCKCHAIN.name(), agreementStatus);
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
                10, "PREPARING_BLOCKCHAIN", OffsetDateTime.now(), OffsetDateTime.now());
    }

    private static final class FakeOperatorGateway implements OperatorTransactionGateway {
        private int prepareCalls;
        private int broadcastCalls;
        private boolean prepareFails;
        private boolean broadcastUncertain;
        private BlockchainTransactionReceipt receipt;
        private PreparedOperatorTransaction lastBroadcast;
        private String failingReceiptHash;
        private BigInteger latestBlock = BigInteger.ZERO;

        @Override
        public PreparedOperatorTransaction prepare(
                long chainId, String fromAddress, String toAddress, String calldata) {
            prepareCalls++;
            if (prepareFails) {
                throw new OperatorTransactionException("simulated prepare failure");
            }
            return new PreparedOperatorTransaction(BigInteger.valueOf(7), TX_HASH, "0xdeadbeef");
        }

        @Override
        public String broadcast(PreparedOperatorTransaction transaction) {
            broadcastCalls++;
            lastBroadcast = transaction;
            if (broadcastUncertain) {
                throw new OperatorTransactionException("simulated RPC timeout");
            }
            return TX_HASH;
        }

        @Override
        public Optional<BlockchainTransactionReceipt> findReceipt(String transactionHash) {
            if (transactionHash.equals(failingReceiptHash)) throw new OperatorTransactionException("simulated receipt RPC failure");
            return Optional.ofNullable(receipt);
        }

        @Override
        public BigInteger latestBlockNumber() {
            return latestBlock;
        }
    }
}
