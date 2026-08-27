package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainTransactionReceipt;
import iuh.fit.contract_service.blockchain.OperatorTransactionGateway;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.enums.BlockchainTransactionStatus;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

public class BlockchainReceiptWatcher {
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
        List<BlockchainTransaction> candidates = repository.findByStatusInOrderByUpdatedAtAsc(
                List.of(BlockchainTransactionStatus.DISPATCHING, BlockchainTransactionStatus.SUBMITTED));
        if (candidates.isEmpty()) {
            return 0;
        }
        BigInteger latestBlock = gateway.latestBlockNumber();
        int changed = 0;
        for (BlockchainTransaction candidate : candidates) {
            if (candidate.getTransactionHash() == null) {
                continue;
            }
            BlockchainTransactionReceipt receipt = gateway.findReceipt(candidate.getTransactionHash()).orElse(null);
            if (receipt == null) {
                continue;
            }
            if (!receipt.successful()) {
                fail(candidate, receipt);
                changed++;
                continue;
            }
            BigInteger confirmations = latestBlock
                    .subtract(BigInteger.valueOf(receipt.blockNumber()))
                    .add(BigInteger.ONE);
            if (confirmations.compareTo(BigInteger.valueOf(properties.getConfirmations())) >= 0) {
                confirm(candidate, receipt);
                changed++;
            } else if (candidate.getStatus() == BlockchainTransactionStatus.DISPATCHING) {
                markObservedSubmitted(candidate);
                changed++;
            }
        }
        return changed;
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
