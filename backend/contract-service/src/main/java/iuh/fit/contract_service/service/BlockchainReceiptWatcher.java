package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainTransactionReceipt;
import iuh.fit.contract_service.blockchain.OperatorTransactionGateway;
import iuh.fit.contract_service.blockchain.PreparedOperatorTransaction;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.enums.BlockchainTransactionStatus;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigInteger;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

public class BlockchainReceiptWatcher {
    private static final Logger log = LoggerFactory.getLogger(BlockchainReceiptWatcher.class);
    private final BlockchainTransactionRepository repository;
    private final OperatorTransactionGateway gateway;
    private final BlockchainProperties properties;
    private final TransactionTemplate transactionTemplate;

    public BlockchainReceiptWatcher(
            BlockchainTransactionRepository repository,
            OperatorTransactionGateway gateway,
            BlockchainProperties properties,
            PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.gateway = gateway;
        this.properties = properties;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public int reconcilePendingReceipts() {
        return reconcilePendingReceipts(properties.getReceiptWatchBatchSize());
    }

    public int reconcilePendingReceipts(int maxBatchSize) {
        List<BlockchainTransaction> candidates = repository.findByStatusInOrderByUpdatedAtAsc(
                List.of(BlockchainTransactionStatus.DISPATCHING, BlockchainTransactionStatus.SUBMITTED),
                PageRequest.of(0, Math.max(1, maxBatchSize)));
        if (candidates.isEmpty()) {
            return 0;
        }
        BigInteger latestBlock = gateway.latestBlockNumber();
        int changed = 0;
        OffsetDateTime current = now();
        for (BlockchainTransaction candidate : candidates) {
            try {
            if (candidate.getTransactionHash() == null) {
                if (isStale(candidate, current)) {
                    resetOrFailUnpreparedDispatch(candidate, current);
                    changed++;
                }
                continue;
            }
            BlockchainTransactionReceipt receipt = gateway.findReceipt(candidate.getTransactionHash()).orElse(null);
            if (receipt == null) {
                rebroadcastUncertain(candidate, current);
                if (isStale(candidate, current)) {
                    flagDelayedReceipt(candidate, current);
                    changed++;
                }
                continue;
            }
            BigInteger confirmations = latestBlock
                    .subtract(BigInteger.valueOf(receipt.blockNumber()))
                    .add(BigInteger.ONE);
            if (confirmations.compareTo(BigInteger.valueOf(properties.getConfirmations())) >= 0) {
                if (receipt.successful()) {
                    confirm(candidate, receipt);
                } else {
                    fail(candidate, receipt);
                }
                changed++;
            } else if (candidate.getStatus() == BlockchainTransactionStatus.DISPATCHING) {
                markObservedSubmitted(candidate);
                changed++;
            }
            } catch (RuntimeException failure) {
                log.warn("Receipt reconciliation deferred for transaction {} ({})",
                        candidate.getId(), failure.getClass().getSimpleName());
            } finally {
                // Rotate pending rows so a missing receipt cannot starve later batches.
                transactionTemplate.executeWithoutResult(status -> {
                    BlockchainTransaction locked = lock(candidate);
                    locked.recordReceiptCheck(now());
                    repository.saveAndFlush(locked);
                });
            }
        }
        return changed;
    }

    private void rebroadcastUncertain(BlockchainTransaction candidate, OffsetDateTime current) {
        if ((candidate.getStatus() != BlockchainTransactionStatus.DISPATCHING
                && !(candidate.getStatus() == BlockchainTransactionStatus.SUBMITTED && isStale(candidate, current)))
                || candidate.getSignedRawTransaction() == null
                || (candidate.getNextAttemptAt() != null && current.isBefore(candidate.getNextAttemptAt()))) return;
        try {
            String hash = gateway.broadcast(new PreparedOperatorTransaction(candidate.getNonce(),
                    candidate.getTransactionHash(), candidate.getSignedRawTransaction()));
            transactionTemplate.executeWithoutResult(status -> {
                var locked = lock(candidate);
                if (locked.getStatus() == BlockchainTransactionStatus.DISPATCHING) {
                    locked.markSubmitted(hash, current);
                }
                if (locked.getStatus() == BlockchainTransactionStatus.SUBMITTED) {
                    locked.recordRebroadcastAttempt(null,
                            current.plus(Duration.ofMillis(properties.getDispatchRetryDelayMs())), current);
                    repository.saveAndFlush(locked);
                }
            });
        } catch (RuntimeException uncertain) {
            transactionTemplate.executeWithoutResult(status -> {
                var locked = lock(candidate);
                if (locked.getStatus() == BlockchainTransactionStatus.DISPATCHING
                        || locked.getStatus() == BlockchainTransactionStatus.SUBMITTED) {
                    locked.recordRebroadcastAttempt("Rebroadcast not acknowledged; still watching the original hash",
                            current.plus(Duration.ofMillis(properties.getDispatchRetryDelayMs())), current);
                    repository.saveAndFlush(locked);
                }
            });
        }
    }

    private boolean isStale(BlockchainTransaction candidate, OffsetDateTime current) {
        OffsetDateTime reference = candidate.getDispatchStartedAt() != null
                ? candidate.getDispatchStartedAt()
                : candidate.getUpdatedAt();
        if (reference == null) {
            return false;
        }
        Duration age = Duration.between(reference, current);
        return !age.isNegative() && age.toMillis() >= properties.getTransactionStaleTimeoutMs();
    }

    private void resetOrFailUnpreparedDispatch(BlockchainTransaction candidate, OffsetDateTime current) {
        transactionTemplate.executeWithoutResult(status -> {
            BlockchainTransaction locked = lock(candidate);
            if (locked.getStatus() != BlockchainTransactionStatus.DISPATCHING
                    || locked.getTransactionHash() != null
                    || !isStale(locked, current)) {
                return;
            }
            if (locked.getAttemptCount() >= properties.getMaxDispatchAttempts()) {
                locked.failBeforeBroadcast("Unprepared dispatch exceeded stale timeout before broadcast", current);
            } else {
                locked.retryBeforeBroadcast(
                        "Unprepared dispatch exceeded stale timeout before broadcast",
                        current.plus(Duration.ofMillis(properties.getDispatchRetryDelayMs())),
                        current);
            }
            repository.saveAndFlush(locked);
        });
    }

    private void flagDelayedReceipt(BlockchainTransaction candidate, OffsetDateTime current) {
        transactionTemplate.executeWithoutResult(status -> {
            BlockchainTransaction locked = lock(candidate);
            if ((locked.getStatus() == BlockchainTransactionStatus.DISPATCHING
                    || locked.getStatus() == BlockchainTransactionStatus.SUBMITTED)
                    && locked.getTransactionHash() != null
                    && isStale(locked, current)) {
                locked.awaitReceiptReview(current);
                repository.saveAndFlush(locked);
            }
        });
    }

    private void markObservedSubmitted(BlockchainTransaction candidate) {
        transactionTemplate.executeWithoutResult(status -> {
            BlockchainTransaction locked = lock(candidate);
            if (locked.getStatus() == BlockchainTransactionStatus.DISPATCHING) {
                locked.markSubmitted(candidate.getTransactionHash(), now());
                repository.saveAndFlush(locked);
            }
        });
    }

    private void confirm(BlockchainTransaction candidate, BlockchainTransactionReceipt receipt) {
        transactionTemplate.executeWithoutResult(status -> {
            BlockchainTransaction locked = lock(candidate);
            if (locked.getStatus() == BlockchainTransactionStatus.DISPATCHING
                    || locked.getStatus() == BlockchainTransactionStatus.SUBMITTED) {
                locked.confirm((short) 1, receipt.blockNumber(), receipt.blockHash(), now());
                repository.saveAndFlush(locked);
            }
        });
    }

    private void fail(BlockchainTransaction candidate, BlockchainTransactionReceipt receipt) {
        transactionTemplate.executeWithoutResult(status -> {
            BlockchainTransaction locked = lock(candidate);
            if (locked.getStatus() == BlockchainTransactionStatus.DISPATCHING
                    || locked.getStatus() == BlockchainTransactionStatus.SUBMITTED) {
                locked.fail((short) 0, receipt.blockNumber(), receipt.blockHash(),
                        "On-chain transaction reverted", now());
                repository.saveAndFlush(locked);
            }
        });
    }

    private BlockchainTransaction lock(BlockchainTransaction candidate) {
        return repository.lockById(candidate.getId()).orElseThrow(() ->
                new IllegalStateException("Blockchain transaction disappeared during receipt reconciliation: "
                        + candidate.getId()));
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }
}
