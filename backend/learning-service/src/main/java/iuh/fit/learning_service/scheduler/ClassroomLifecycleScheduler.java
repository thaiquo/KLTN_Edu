package iuh.fit.learning_service.scheduler;

import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.service.ClassroomLifecycleService;
import iuh.fit.learning_service.service.SessionAttendanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ClassroomLifecycleScheduler {

    private static final String BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
    private static final ZoneId BUSINESS_ZONE = ZoneId.of(BUSINESS_TIME_ZONE);

    private final ClassRoomRepository classRoomRepository;
    private final ClassroomLifecycleService classroomLifecycleService;
    private final SessionAttendanceService sessionAttendanceService;

    /**
     * Quét định kỳ mỗi ngày lúc 00:01 sáng để tự động xử lý vòng đời các lớp đến ngày khai giảng (startDate <= today):
     * - Lớp 0 học viên hiệu lực -> tự động đóng (CLOSED), giải phóng lịch và hủy request chờ.
     * - Lớp có học viên hiệu lực -> tự động khóa tuyển sinh (LOCKED) và mở các buổi học tuần đầu tiên.
     * Mỗi lớp được xử lý trong transaction độc lập có khóa bi quan để chống race condition.
     */
    @Scheduled(cron = "0 1 0 * * *", zone = BUSINESS_TIME_ZONE)
    public void scanAndLockStartingClassrooms() {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        log.info("ClassroomLifecycleScheduler: Running daily scan for classrooms starting on or before {}", today);

        List<Long> candidateIds = classRoomRepository.findStartingClassroomCandidateIds(
                ClassRoomStatus.PUBLISHED, ClassRoomStatus.ACTIVE, today
        );

        for (Long classroomId : candidateIds) {
            try {
                classroomLifecycleService.processStartingClassroom(classroomId, today);
            } catch (Exception e) {
                log.error("Failed to process lifecycle for ClassRoom #{}: {}", classroomId, e.getMessage(), e);
            }
        }
    }

    /**
     * Quét định kỳ mỗi 1 phút để tự động hoàn tất các buổi học đã kết thúc thời gian thực tế (now >= endTime),
     * tự động phân xử kết quả điểm danh và kích hoạt sinh cuốn chiếu tuần tiếp theo.
     */
    @Scheduled(fixedDelay = 60000)
    public void scanAndFinalizePastDueSessions() {
        try {
            sessionAttendanceService.autoFinalizePastDueSessions();
        } catch (Exception e) {
            log.error("Error during autoFinalizePastDueSessions: {}", e.getMessage(), e);
        }
    }

    /**
     * Chạy 1 lần khi ứng dụng khởi động xong để đảm bảo không bị sót các lớp đã đến ngày bắt đầu hoặc buổi học cần hoàn tất.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("ClassroomLifecycleScheduler initialized. Running startup check for starting classrooms...");
        try {
            scanAndLockStartingClassrooms();
            scanAndFinalizePastDueSessions();
        } catch (Exception e) {
            log.warn("Startup classroom lifecycle check completed with warnings: {}", e.getMessage());
        }
    }
}
