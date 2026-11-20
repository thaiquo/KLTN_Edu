package iuh.fit.api_gateway.reporting;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/** Proactively evaluates SLA without requiring a user to open Action Center. */
@Component
public class OperationalSlaScheduler {
    private static final Logger log = LoggerFactory.getLogger(OperationalSlaScheduler.class);

    private final OperationalWorkItemService workItems;
    private final OperationalSlaNotificationPublisher notifications;
    private final boolean enabled;
    private final AtomicBoolean running = new AtomicBoolean();

    public OperationalSlaScheduler(OperationalWorkItemService workItems,
                                   OperationalSlaNotificationPublisher notifications,
                                   @Value("${operations.sla.scheduler.enabled:true}") boolean enabled) {
        this.workItems = workItems;
        this.notifications = notifications;
        this.enabled = enabled;
    }

    @Scheduled(initialDelayString = "${operations.sla.scheduler.initial-delay:PT30S}",
            fixedDelayString = "${operations.sla.scheduler.interval:PT5M}")
    public void evaluate() {
        if (!enabled || !running.compareAndSet(false, true)) {
            if (enabled) log.info("Operational SLA scheduler skipped because the previous run is still active");
            return;
        }
        long started = System.nanoTime();
        workItems.schedulerBatch()
                .flatMap(batch -> notifications.publish(batch.items()).thenReturn(batch))
                .doOnSuccess(batch -> log.info(
                        "Operational SLA scheduler completed itemCount={} unavailableSources={} durationMs={}",
                        batch.items().size(),
                        batch.sources().stream().filter(source -> source.status()
                                == OperationalWorkItemService.SourceStatus.UNAVAILABLE).count(),
                        elapsed(started)))
                .doOnError(error -> log.warn("Operational SLA scheduler failed cause={} durationMs={}",
                        error.getClass().getSimpleName(), elapsed(started)))
                .doFinally(signal -> running.set(false))
                .subscribe();
    }

    private long elapsed(long started) {
        return Math.max(0, (System.nanoTime() - started) / 1_000_000L);
    }
}
