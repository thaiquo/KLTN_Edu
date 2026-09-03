package iuh.fit.learning_service.scheduler;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.service.RollingSessionService;
import iuh.fit.learning_service.service.SessionAttendanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ClassroomLifecycleScheduler {

    private final ClassRoomRepository classRoomRepository;
    private final RollingSessionService rollingSessionService;
    private final SessionAttendanceService sessionAttendanceService;

    /**
     * Quét định kỳ mỗi ngày lúc 00:01 sáng để tự động khóa tuyển sinh các lớp đến ngày khai giảng (startDate <= today)
     * và tự động mở các buổi học của tuần đầu tiên.
     */
    @Scheduled(cron = "0 1 0 * * *")
    @Transactional
    public void scanAndLockStartingClassrooms() {
        LocalDate today = LocalDate.now();
        log.info("ClassroomLifecycleScheduler: Running daily scan for classrooms starting on or before {}", today);

        List<ClassRoom> startingClasses = classRoomRepository.findAll().stream()
                .filter(c -> (c.getStatus() == ClassRoomStatus.PUBLISHED || c.getStatus() == ClassRoomStatus.ACTIVE)
                        && c.getStartDate() != null && !c.getStartDate().isAfter(today))
                .toList();

        for (ClassRoom classRoom : startingClasses) {
            try {
                if (classRoom.getStatus() == ClassRoomStatus.PUBLISHED) {
                    classRoom.setStatus(ClassRoomStatus.LOCKED);
                    classRoomRepository.save(classRoom);
                    log.info("Auto-locked recruitment for ClassRoom #{} ({}) due to reaching startDate {}",
                            classRoom.getId(), classRoom.getName(), classRoom.getStartDate());
                }

                rollingSessionService.generateInitialWeekSessions(classRoom.getId());
            } catch (Exception e) {
                log.error("Failed to process lifecycle for ClassRoom #{}: {}", classRoom.getId(), e.getMessage(), e);
            }
        }
    }

    /**
     * Quét định kỳ mỗi 1 phút để tự động hoàn tất các buổi học đã kết thúc thời gian thực tế (now >= endTime),
     * tự động phân xử kết quả điểm danh và kích hoạt sinh cuốn chiếu tuần tiếp theo.
     */
    @Scheduled(fixedDelay = 60000)
    @Transactional
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
