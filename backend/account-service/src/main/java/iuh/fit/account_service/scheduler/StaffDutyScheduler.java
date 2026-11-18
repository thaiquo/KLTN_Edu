package iuh.fit.account_service.scheduler;

import iuh.fit.account_service.service.StaffDutyRosterService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class StaffDutyScheduler {
    private static final Logger log = LoggerFactory.getLogger(StaffDutyScheduler.class);
    private final StaffDutyRosterService service;
    private final boolean autoSchedulingEnabled;

    public StaffDutyScheduler(
            StaffDutyRosterService service,
            @Value("${staff.duty.auto-scheduling-enabled:true}") boolean autoSchedulingEnabled
    ) {
        this.service = service;
        this.autoSchedulingEnabled = autoSchedulingEnabled;
    }

    @Scheduled(cron = "${staff.duty.close-cron:0 */5 * * * *}", zone = "Asia/Bangkok")
    public void closeExpiredShifts() {
        service.closeExpiredShifts();
        if (!autoSchedulingEnabled) return;
        try {
            service.ensureAutomaticCoverage();
        } catch (RuntimeException exception) {
            // Keep the close-shift job alive. The next run retries after an Admin
            // activates enough Staff or resolves invalid draft assignments.
            log.warn("Automatic staff-duty coverage deferred: {}", exception.getMessage());
        }
    }
}
