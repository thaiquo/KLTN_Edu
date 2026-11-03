package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClassroomLifecycleService {

    private final ClassRoomRepository classRoomRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final ClassSessionRepository classSessionRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;
    private final RollingSessionService rollingSessionService;
    private final RealtimeEventHub realtimeEventHub;

    /**
     * Process lifecycle for an individual classroom that has reached its start date.
     * Runs in its own transaction with a pessimistic write lock to prevent race conditions.
     */
    @Transactional
    public void processStartingClassroom(Long classroomId, LocalDate today) {
        ClassRoom room = classRoomRepository.findByIdForUpdate(classroomId).orElse(null);
        if (room == null) {
            return;
        }

        // Re-check start date and eligibility under lock
        if (room.getStartDate() == null || room.getStartDate().isAfter(today)) {
            return;
        }
        if (room.getStatus() != ClassRoomStatus.PUBLISHED && room.getStatus() != ClassRoomStatus.ACTIVE) {
            return;
        }

        // Effective students include ACCEPTED (in funding pipeline) and ENROLLED (activated)
        long activeStudents = enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                classroomId,
                List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED)
        );

        if (activeStudents == 0) {
            // 0 active students: auto-close classroom, release schedule, cancel pending requests & sessions
            if (room.getStatus() == ClassRoomStatus.CLOSED) {
                return;
            }

            room.setStatus(ClassRoomStatus.CLOSED);
            classRoomRepository.save(room);

            // Cancel any remaining PENDING requests
            List<EnrollmentRequest> pendingRequests = enrollmentRequestRepository.findByClassRoomIdAndStatus(
                    classroomId, EnrollmentRequestStatus.PENDING
            );
            for (EnrollmentRequest req : pendingRequests) {
                req.setStatus(EnrollmentRequestStatus.CANCELLED);
                req.setRejectReason("Lớp tự đóng do không có học viên khi đến ngày khai giảng");
                enrollmentRequestRepository.save(req);
            }

            // Cancel uncompleted sessions and clean attendance if any were pre-generated
            List<ClassSession> sessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classroomId);
            for (ClassSession session : sessions) {
                if (session.getStatus() != ClassSessionStatus.COMPLETED) {
                    session.setStatus(ClassSessionStatus.CANCELLED);
                    classSessionRepository.save(session);
                    sessionAttendanceRepository.deleteBySession_Id(session.getId());
                }
            }

            // Notify tutor via realtime WebSocket
            if (room.getTutorEmail() != null) {
                realtimeEventHub.publishToUser(room.getTutorEmail(), "CLASS_AUTO_CLOSED", room.getId(), Map.of(
                        "className", room.getName() != null ? room.getName() : "",
                        "reason", "Lớp tự đóng do không có học viên khi đến ngày khai giảng"
                ));
            }

            log.info("Auto-closed ClassRoom #{} ({}) due to reaching startDate {} with 0 active students",
                    room.getId(), room.getName(), room.getStartDate());
        } else {
            // Has active students: lock recruitment and generate initial week sessions
            if (room.getStatus() == ClassRoomStatus.PUBLISHED) {
                room.setStatus(ClassRoomStatus.LOCKED);
                classRoomRepository.save(room);
                log.info("Auto-locked recruitment for ClassRoom #{} ({}) with {} active students due to reaching startDate {}",
                        room.getId(), room.getName(), activeStudents, room.getStartDate());
            }

            rollingSessionService.generateInitialWeekSessions(classroomId);
        }
    }
}

