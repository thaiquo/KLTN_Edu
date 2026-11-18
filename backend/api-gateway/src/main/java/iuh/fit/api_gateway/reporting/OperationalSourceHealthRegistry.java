package iuh.fit.api_gateway.reporting;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** In-process health history for operational source polling. */
@Component
public class OperationalSourceHealthRegistry {
    private static final Logger log = LoggerFactory.getLogger(OperationalSourceHealthRegistry.class);

    private final Map<String, Snapshot> snapshots = new ConcurrentHashMap<>();

    OperationalWorkItemService.SourceHealth success(String source, long latencyMs, long itemCount,
                                                     long degradedThresholdMs) {
        Instant checkedAt = Instant.now();
        var status = latencyMs >= degradedThresholdMs
                ? OperationalWorkItemService.SourceStatus.DEGRADED
                : OperationalWorkItemService.SourceStatus.SUCCESS;
        Snapshot next = new Snapshot(status, latencyMs, checkedAt, checkedAt, null, null, itemCount);
        transition(source, next);
        return health(source, next);
    }

    OperationalWorkItemService.SourceHealth unavailable(String source, long latencyMs,
                                                         String errorCode, String errorSummary) {
        Instant checkedAt = Instant.now();
        Snapshot previous = snapshots.get(source);
        Snapshot next = new Snapshot(OperationalWorkItemService.SourceStatus.UNAVAILABLE, latencyMs,
                previous == null ? null : previous.lastSuccessfulRefresh(), checkedAt,
                errorCode, errorSummary, null);
        transition(source, next);
        return health(source, next);
    }

    private void transition(String source, Snapshot next) {
        Snapshot previous = snapshots.put(source, next);
        if (previous == null || previous.status() != next.status()) {
            if (next.status() == OperationalWorkItemService.SourceStatus.UNAVAILABLE) {
                log.warn("Operational source unavailable source={} errorCode={}", source, next.errorCode());
            } else if (previous != null && previous.status() == OperationalWorkItemService.SourceStatus.UNAVAILABLE) {
                log.info("Operational source recovered source={} status={} latencyMs={}",
                        source, next.status(), next.latencyMs());
            } else if (next.status() == OperationalWorkItemService.SourceStatus.DEGRADED) {
                log.warn("Operational source degraded source={} latencyMs={}", source, next.latencyMs());
            }
        }
    }

    private OperationalWorkItemService.SourceHealth health(String source, Snapshot snapshot) {
        return new OperationalWorkItemService.SourceHealth(source, snapshot.status(), snapshot.latencyMs(),
                text(snapshot.lastSuccessfulRefresh()), snapshot.errorCode(), snapshot.errorSummary(),
                snapshot.itemCount(), text(snapshot.checkedAt()));
    }

    private String text(Instant value) {
        return value == null ? null : value.toString();
    }

    private record Snapshot(OperationalWorkItemService.SourceStatus status, long latencyMs,
                            Instant lastSuccessfulRefresh, Instant checkedAt, String errorCode,
                            String errorSummary, Long itemCount) { }
}
