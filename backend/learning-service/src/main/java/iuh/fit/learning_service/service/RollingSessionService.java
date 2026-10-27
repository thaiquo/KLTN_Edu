package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.entity.SessionAttendance;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RollingSessionService {

    private final ClassRoomRepository classRoomRepository;
    private final ClassSessionRepository classSessionRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;
    private final CanonicalSessionPlanner sessionPlanner;

    /**
     * Tự động sinh danh sách các buổi học của tuần đầu tiên khi lớp bắt đầu mở dạy hoặc khi hợp đồng được kích hoạt.
     */
    @Transactional
    public List<ClassSession> generateInitialWeekSessions(Long classroomId) {
        ClassRoom classRoom = classRoomRepository.findByIdForUpdate(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("ClassRoom not found: " + classroomId));
        if (classRoom.getStatus() == ClassRoomStatus.CANCELLED
                || classRoom.getStatus() == ClassRoomStatus.CLOSED
                || classRoom.getTerminationCutoffSession() != null) {
            log.info("ClassRoom {} is CANCELLED, CLOSED, or terminating. Skipping initial generation.", classroomId);
            return Collections.emptyList();
        }

        long existingCount = classSessionRepository.countByClassRoomId(classroomId);
        if (existingCount > 0) {
            log.info("ClassRoom {} already has {} sessions. Skipping initial generation.", classroomId, existingCount);
            return classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classroomId);
        }

        if (classRoom.getSchedules() == null || classRoom.getSchedules().isEmpty()) {
            log.warn("ClassRoom {} has no schedules configured.", classroomId);
            return Collections.emptyList();
        }

        int targetBatchSize = Math.min(
                classRoom.getSessionsPerWeek() != null && classRoom.getSessionsPerWeek() > 0 ? classRoom.getSessionsPerWeek() : 3,
                classRoom.getTotalSessions() != null && classRoom.getTotalSessions() > 0 ? classRoom.getTotalSessions() : 12
        );
        List<ClassSession> createdSessions = new ArrayList<>();
        for (CanonicalSessionPlanner.PlannedSession planned : sessionPlanner.plan(classRoom).stream()
                .limit(targetBatchSize).toList()) {
            ClassSession savedSession = persist(planned, classRoom);
            createAttendancesForEnrolledStudents(savedSession, classRoom);
            createdSessions.add(savedSession);
        }

        log.info("Generated {} initial sessions for ClassRoom {}", createdSessions.size(), classroomId);
        return createdSessions;
    }

    /**
     * Tự động sinh cuốn chiếu đợt buổi học tiếp theo (tuần tiếp theo) khi buổi học cuối cùng của đợt hiện tại hoàn thành.
     */
    @Transactional
    public List<ClassSession> generateNextBatchIfNeeded(Long classroomId) {
        ClassRoom classRoom = classRoomRepository.findByIdForUpdate(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("ClassRoom not found: " + classroomId));
        if (classRoom.getStatus() == ClassRoomStatus.CANCELLED
                || classRoom.getStatus() == ClassRoomStatus.CLOSED
                || classRoom.getTerminationCutoffSession() != null) {
            log.info("ClassRoom {} is CANCELLED, CLOSED, or terminating. Skipping next batch generation.", classroomId);
            return Collections.emptyList();
        }

        List<ClassSession> existingSessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classroomId);
        if (existingSessions.isEmpty()) {
            return generateInitialWeekSessions(classroomId);
        }

        int currentCount = existingSessions.size();
        if (currentCount >= classRoom.getTotalSessions()) {
            log.info("ClassRoom {} already reached totalSessions limit ({}).", classroomId, classRoom.getTotalSessions());
            return Collections.emptyList();
        }

        if (existingSessions.stream().anyMatch(session -> session.getStatus() != ClassSessionStatus.COMPLETED)) {
            return Collections.emptyList();
        }
        int nextBatchSize = Math.min(classRoom.getSessionsPerWeek(), classRoom.getTotalSessions() - currentCount);
        if (classRoom.getSchedules() == null || classRoom.getSchedules().isEmpty()) return Collections.emptyList();
        List<CanonicalSessionPlanner.PlannedSession> plannedSessions = sessionPlanner.plan(classRoom);
        sessionPlanner.requirePersistedPrefix(classRoom, existingSessions);
        List<ClassSession> nextBatch = new ArrayList<>();
        for (CanonicalSessionPlanner.PlannedSession planned : plannedSessions.stream()
                .skip(currentCount).limit(nextBatchSize).toList()) {
            ClassSession savedSession = persist(planned, classRoom);
            createAttendancesForEnrolledStudents(savedSession, classRoom);
            nextBatch.add(savedSession);
        }

        log.info("Generated {} next batch sessions for ClassRoom {}", nextBatch.size(), classroomId);
        return nextBatch;
    }

    private void createAttendancesForEnrolledStudents(ClassSession session, ClassRoom classRoom) {
        List<EnrollmentRequest> enrolledRequests = enrollmentRequestRepository.findByClassRoomIdAndStatus(
                classRoom.getId(), EnrollmentRequestStatus.ENROLLED);

        Long tutorProfileId = classRoom.getTutorProfileId() != null ? classRoom.getTutorProfileId() : 0L;

        for (EnrollmentRequest req : enrolledRequests) {
            SessionAttendance attendance = new SessionAttendance();
            attendance.setSession(session);
            attendance.setStudentId(req.getStudentId());
            attendance.setStudentEmail(req.getStudentEmail());
            attendance.setStudentName(req.getStudentName());
            attendance.setTutorId(tutorProfileId);
            attendance.setTutorChecked(false);
            attendance.setStudentChecked(false);
            sessionAttendanceRepository.save(attendance);
        }
    }

    @Transactional
    public int createMissingAttendancesForEnrollment(EnrollmentRequest enrollmentRequest) {
        if (enrollmentRequest == null
                || enrollmentRequest.getClassRoom() == null
                || enrollmentRequest.getClassRoom().getId() == null
                || enrollmentRequest.getStudentId() == null) {
            return 0;
        }

        ClassRoom classRoom = enrollmentRequest.getClassRoom();
        Long tutorProfileId = classRoom.getTutorProfileId() != null ? classRoom.getTutorProfileId() : 0L;
        int created = 0;

        List<ClassSession> sessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classRoom.getId());
        for (ClassSession session : sessions) {
            if (session.getStatus() == ClassSessionStatus.COMPLETED || session.getStatus() == ClassSessionStatus.CANCELLED) {
                continue;
            }
            if (sessionAttendanceRepository.findBySessionIdAndStudentId(session.getId(), enrollmentRequest.getStudentId()).isPresent()) {
                continue;
            }

            SessionAttendance attendance = new SessionAttendance();
            attendance.setSession(session);
            attendance.setStudentId(enrollmentRequest.getStudentId());
            attendance.setStudentEmail(enrollmentRequest.getStudentEmail());
            attendance.setStudentName(enrollmentRequest.getStudentName());
            attendance.setTutorId(tutorProfileId);
            attendance.setTutorChecked(false);
            attendance.setStudentChecked(false);
            sessionAttendanceRepository.save(attendance);
            created++;
        }

        if (created > 0) {
            log.info("Created {} missing attendance rows for student {} in ClassRoom {}",
                    created, enrollmentRequest.getStudentId(), classRoom.getId());
        }
        return created;
    }

    private ClassSession persist(CanonicalSessionPlanner.PlannedSession planned, ClassRoom classRoom) {
        ClassSession session = new ClassSession();
        session.setClassRoom(classRoom);
        session.setSequenceNumber(planned.sequenceNumber());
        session.setTopic("Buổi " + planned.sequenceNumber());
        session.setSessionDate(planned.sessionDate());
        session.setStartTime(planned.startTime());
        session.setEndTime(planned.endTime());
        session.setStatus(ClassSessionStatus.SCHEDULED);
        return classSessionRepository.save(session);
    }
}
