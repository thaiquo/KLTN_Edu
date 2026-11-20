package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.HealthResponse;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.ReadinessStatus;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.SyncResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
        name = "semantic.index.auto-recovery-enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class TutorSemanticIndexRecoveryScheduler {
    private static final Logger log = LoggerFactory.getLogger(TutorSemanticIndexRecoveryScheduler.class);
    private final TutorSemanticIndexService indexService;

    public TutorSemanticIndexRecoveryScheduler(TutorSemanticIndexService indexService) {
        this.indexService = indexService;
    }

    @Scheduled(
            initialDelayString = "${semantic.index.startup-delay-ms:5000}",
            fixedDelayString = "${semantic.index.recovery-interval-ms:60000}"
    )
    public void recoverIfNeeded() {
        try {
            HealthResponse health = indexService.health();
            if (health.status() == ReadinessStatus.READY && health.lastSuccessfulSyncAt() != null) {
                return;
            }
            SyncResult result = indexService.sync(null);
            log.info("Tutor semantic index recovery completed: indexed={}, skipped={}, failed={}",
                    result.indexed(), result.skipped(), result.failed());
        } catch (RuntimeException exception) {
            log.warn("Tutor semantic index recovery deferred: {}", exception.getClass().getSimpleName());
        }
    }
}
