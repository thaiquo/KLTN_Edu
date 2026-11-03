package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
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

    private static final String START_DATE_CANCELLATION_REASON =
            "Lớp đã đóng yêu cầu tham gia khi đến ngày khai giảng";
    private static final String EMPTY_CLASS_CLOSURE_REASON =
            "Lớp tự đóng do không có học viên khi đến ngày khai giảng";

    private final ClassRoomRepository classRoomRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final ClassSessionRepository classSessionRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;
    private final RollingSessionService rollingSessionService;
    private final RealtimeEventHub realtimeEventHub;
    private final LearningEventPublisher eventPublisher;

    /**
     * Processes a classroom that has reached its start date in an isolated transaction.
     * The pessimistic classroom lock serializes this job with enrollment acceptance.
     */
    @Transactional
    public void processStartingClassroom(Long classroomId, LocalDate today) {
        ClassRoom room = classRoomRepository.findByIdForUpdate(classroomId).orElse(null);
        if (room == null) {
            return;
        }

        if (room.getStartDate() == null || room.getStartDate().isAfter(today)) {
            return;
        }
        if (room.getStatus() != ClassRoomStatus.PUBLISHED && room.getStatus() != ClassRoomStatus.ACTIVE) {
            return;
        }
        if (room.getTerminationCutoffSession() != null) {
            return;
        }

        // ACTIVE is a legacy/running state. Learning enrollment rows alone are not
        // sufficient evidence to close it safely because contract state is external.
        if (room.getStatus() == ClassRoomStatus.ACTIVE) {
            rollingSessionService.generateInitialWeekSessions(classroomId);
            return;
        }

        long effectiveStudents = enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                classroomId,
                List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED)
        );

        if (effectiveStudents == 0) {
            room.setStatus(ClassRoomStatus.CLOSED);
            classRoomRepository.save(room);
            cancelPendingRequests(room, EMPTY_CLASS_CLOSURE_REASON);
            cancelFutureScheduledSessions(classroomId, today);

            if (room.getTutorEmail() != null) {
                realtimeEventHub.publishToUser(room.getTutorEmail(), "CLASS_AUTO_CLOSED", room.getId(), Map.of(
                        "className", room.getName() != null ? room.getName() : "",
                        "reason", EMPTY_CLASS_CLOSURE_REASON
                ));
            }

            log.info("Auto-closed ClassRoom #{} ({}) at startDate {} with 0 effective students",
                    room.getId(), room.getName(), room.getStartDate());
            return;
        }

        room.setStatus(ClassRoomStatus.LOCKED);
        classRoomRepository.save(room);
        cancelPendingRequests(room, START_DATE_CANCELLATION_REASON);
        rollingSessionService.generateInitialWeekSessions(classroomId);

        log.info("Auto-locked ClassRoom #{} ({}) at startDate {} with {} effective students",
                room.getId(), room.getName(), room.getStartDate(), effectiveStudents);
    }

    private void cancelPendingRequests(ClassRoom room, String reason) {
        List<EnrollmentRequest> pendingRequests = enrollmentRequestRepository.findByClassRoomIdAndStatus(
                room.getId(), EnrollmentRequestStatus.PENDING
        );
        for (EnrollmentRequest request : pendingRequests) {
            request.setStatus(EnrollmentRequestStatus.CANCELLED);
            request.setRejectReason(reason);
            enrollmentRequestRepository.save(request);
            eventPublisher.publishEnrollmentSystemCancelled(
                    request.getId(),
                    room.getId(),
                    request.getStudentId(),
                    room.getName(),
                    reason,
                    request.getStudentName()
            );
        }
    }

    private void cancelFutureScheduledSessions(Long classroomId, LocalDate today) {
        List<ClassSession> sessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classroomId);
        for (ClassSession session : sessions) {
            if (session.getStatus() == ClassSessionStatus.SCHEDULED
                    && !session.getSessionDate().isBefore(today)) {
                session.setStatus(ClassSessionStatus.CANCELLED);
                classSessionRepository.save(session);
                sessionAttendanceRepository.deleteBySession_Id(session.getId());
            }
        }
    }
}
