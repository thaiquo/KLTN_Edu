package iuh.fit.account_service.scheduler;

import iuh.fit.account_service.service.StaffDutyRosterService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class StaffDutyScheduler {
    private final StaffDutyRosterService service;

    public StaffDutyScheduler(StaffDutyRosterService service) {
        this.service = service;
    }

    @Scheduled(cron = "${staff.duty.close-cron:0 */5 * * * *}", zone = "Asia/Bangkok")
    public void closeExpiredShifts() {
        service.closeExpiredShifts();
    }
}
