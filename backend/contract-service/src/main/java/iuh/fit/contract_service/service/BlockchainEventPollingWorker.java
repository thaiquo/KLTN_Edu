package iuh.fit.contract_service.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

import java.util.concurrent.atomic.AtomicBoolean;

public class BlockchainEventPollingWorker {
    private static final Logger log = LoggerFactory.getLogger(BlockchainEventPollingWorker.class);

    private final BlockchainEventIngestionService ingestionService;
    private final AtomicBoolean running = new AtomicBoolean();

    public BlockchainEventPollingWorker(BlockchainEventIngestionService ingestionService) {
        this.ingestionService = ingestionService;
    }

    @Scheduled(
            initialDelayString = "${blockchain.event-poll-initial-delay-ms:5000}",
            fixedDelayString = "${blockchain.event-poll-interval-ms:5000}")
    public void pollConfirmedEvents() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        try {
            ingestionService.scanNextConfirmedRange();
        } catch (RuntimeException exception) {
            String cause = exception.getCause() != null && exception.getCause().getMessage() != null
                    ? " [cause: " + exception.getCause().getMessage() + "]" : "";
            log.warn("Escrow event polling failed; cursor was not advanced: {}{}", exception.getMessage(), cause);
        } finally {
            running.set(false);
        }
    }

    @Scheduled(
            initialDelayString = "${blockchain.event-reconcile-initial-delay-ms:15000}",
            fixedDelayString = "${blockchain.event-reconcile-interval-ms:30000}")
    public void reconcileConfirmedTransactionEvents() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        try {
            int recovered = ingestionService.reconcileConfirmedTransactionEvents();
            if (recovered > 0) {
                log.info("Recovered {} blockchain event(s) from confirmed transaction receipts", recovered);
            }
        } catch (RuntimeException exception) {
            log.warn("Confirmed transaction event reconciliation failed: {}", exception.getMessage());
        } finally {
            running.set(false);
        }
    }
}
