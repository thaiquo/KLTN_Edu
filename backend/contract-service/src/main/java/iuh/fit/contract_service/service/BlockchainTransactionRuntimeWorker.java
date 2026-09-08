package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.BlockchainProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

import java.util.concurrent.atomic.AtomicBoolean;

public class BlockchainTransactionRuntimeWorker {
    private static final Logger log = LoggerFactory.getLogger(BlockchainTransactionRuntimeWorker.class);

    private final OperatorTransactionDispatcher dispatcher;
    private final BlockchainReceiptWatcher receiptWatcher;
    private final BlockchainProperties properties;
    private final AtomicBoolean dispatchRunning = new AtomicBoolean(false);
    private final AtomicBoolean receiptWatchRunning = new AtomicBoolean(false);

    public BlockchainTransactionRuntimeWorker(
            OperatorTransactionDispatcher dispatcher,
            BlockchainReceiptWatcher receiptWatcher,
            BlockchainProperties properties) {
        this.dispatcher = dispatcher;
        this.receiptWatcher = receiptWatcher;
        this.properties = properties;
    }

    @Scheduled(
            initialDelayString = "${blockchain.dispatcher-initial-delay-ms:5000}",
            fixedDelayString = "${blockchain.dispatcher-interval-ms:5000}")
    public void dispatchPendingTransactions() {
        if (!dispatchRunning.compareAndSet(false, true)) {
            return;
        }
        try {
            int dispatched = 0;
            int batchSize = Math.max(1, properties.getDispatcherBatchSize());
            while (dispatched < batchSize && dispatcher.dispatchNext().isPresent()) {
                dispatched++;
            }
            if (dispatched > 0) {
                log.info("Dispatched {} blockchain operator transaction(s)", dispatched);
            }
        } catch (RuntimeException exception) {
            log.warn("Blockchain operator transaction dispatch failed; worker will retry on next interval",
                    exception);
        } finally {
            dispatchRunning.set(false);
        }
    }

    @Scheduled(
            initialDelayString = "${blockchain.receipt-watch-initial-delay-ms:7000}",
            fixedDelayString = "${blockchain.receipt-watch-interval-ms:5000}")
    public void reconcilePendingReceipts() {
        if (!receiptWatchRunning.compareAndSet(false, true)) {
            return;
        }
        try {
            int changed = receiptWatcher.reconcilePendingReceipts(properties.getReceiptWatchBatchSize());
            if (changed > 0) {
                log.info("Reconciled {} blockchain operator transaction receipt(s)", changed);
            }
        } catch (RuntimeException exception) {
            log.warn("Blockchain receipt reconciliation failed; worker will retry on next interval", exception);
        } finally {
            receiptWatchRunning.set(false);
        }
    }
}
