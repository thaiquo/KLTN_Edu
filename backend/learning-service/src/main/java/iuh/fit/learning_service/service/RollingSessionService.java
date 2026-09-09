package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.entity.SessionAttendance;
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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RollingSessionService {

    private final ClassRoomRepository classRoomRepository;
    private final ClassSessionRepository classSessionRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;

    /**
     * Tự động sinh danh sách các buổi học của tuần đầu tiên khi lớp bắt đầu mở dạy hoặc khi hợp đồng được kích hoạt.
     */
    @Transactional
    public List<ClassSession> generateInitialWeekSessions(Long classroomId) {
        ClassRoom classRoom = classRoomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("ClassRoom not found: " + classroomId));

        long existingCount = classSessionRepository.countByClassRoomId(classroomId);
        if (existingCount > 0) {
            log.info("ClassRoom {} already has {} sessions. Skipping initial generation.", classroomId, existingCount);
            return classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classroomId);
        }

        List<ClassSchedule> schedules = classRoom.getSchedules();
        if (schedules == null || schedules.isEmpty()) {
            log.warn("ClassRoom {} has no schedules configured.", classroomId);
            return Collections.emptyList();
        }

        // Map schedules by dayOfWeek (Java DayOfWeek: MONDAY(1) ... SUNDAY(7))
        // Note: Project convention day_of_week: 2 = Mon, 3 = Tue, ..., 8 = Sun
        Map<Integer, ClassSchedule> scheduleMap = new HashMap<>();
        for (ClassSchedule cs : schedules) {
            scheduleMap.put(cs.getDayOfWeek(), cs);
        }

        int targetBatchSize = Math.min(
                classRoom.getSessionsPerWeek() != null && classRoom.getSessionsPerWeek() > 0 ? classRoom.getSessionsPerWeek() : 3,
                classRoom.getTotalSessions() != null && classRoom.getTotalSessions() > 0 ? classRoom.getTotalSessions() : 12
        );
        LocalDate currentDate = classRoom.getStartDate() != null ? classRoom.getStartDate() : LocalDate.now();
        List<ClassSession> createdSessions = new ArrayList<>();
        int seq = 1;
        int maxDays = 365;
        int daysChecked = 0;

        // Find matching dates starting from startDate
        while (createdSessions.size() < targetBatchSize && seq <= (classRoom.getTotalSessions() != null ? classRoom.getTotalSessions() : 12) && daysChecked < maxDays) {
            daysChecked++;
            int dayOfWeekConvention = toProjectDayOfWeek(currentDate.getDayOfWeek());
            if (scheduleMap.containsKey(dayOfWeekConvention)) {
                ClassSchedule matchedSchedule = scheduleMap.get(dayOfWeekConvention);

                ClassSession session = new ClassSession();
                session.setClassRoom(classRoom);
                session.setSequenceNumber(seq);
                session.setTopic("Buổi " + seq);
                session.setSessionDate(currentDate);
                session.setStartTime(matchedSchedule.getStartTime());
                session.setEndTime(matchedSchedule.getEndTime());
                session.setStatus(ClassSessionStatus.SCHEDULED);

                ClassSession savedSession = classSessionRepository.save(session);
                createAttendancesForEnrolledStudents(savedSession, classRoom);
                createdSessions.add(savedSession);
                seq++;
            }
            currentDate = currentDate.plusDays(1);
        }

        log.info("Generated {} initial sessions for ClassRoom {}", createdSessions.size(), classroomId);
        return createdSessions;
    }

    /**
     * Tự động sinh cuốn chiếu đợt buổi học tiếp theo (tuần tiếp theo) khi buổi học cuối cùng của đợt hiện tại hoàn thành.
     */
    @Transactional
    public List<ClassSession> generateNextBatchIfNeeded(Long classroomId) {
        ClassRoom classRoom = classRoomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("ClassRoom not found: " + classroomId));

        List<ClassSession> existingSessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classroomId);
        if (existingSessions.isEmpty()) {
            return generateInitialWeekSessions(classroomId);
        }

        int currentCount = existingSessions.size();
        if (currentCount >= classRoom.getTotalSessions()) {
            log.info("ClassRoom {} already reached totalSessions limit ({}).", classroomId, classRoom.getTotalSessions());
            return Collections.emptyList();
        }

        ClassSession lastSession = existingSessions.get(existingSessions.size() - 1);
        int nextBatchSize = Math.min(classRoom.getSessionsPerWeek(), classRoom.getTotalSessions() - currentCount);

        List<ClassSchedule> schedules = classRoom.getSchedules();
        Map<Integer, ClassSchedule> scheduleMap = new HashMap<>();
        for (ClassSchedule cs : schedules) {
            scheduleMap.put(cs.getDayOfWeek(), cs);
        }

        LocalDate currentDate = lastSession.getSessionDate().plusDays(1);
        List<ClassSession> nextBatch = new ArrayList<>();
        int seq = currentCount + 1;

        while (nextBatch.size() < nextBatchSize && seq <= classRoom.getTotalSessions()) {
            int dayOfWeekConvention = toProjectDayOfWeek(currentDate.getDayOfWeek());
            if (scheduleMap.containsKey(dayOfWeekConvention)) {
                ClassSchedule matchedSchedule = scheduleMap.get(dayOfWeekConvention);

                ClassSession session = new ClassSession();
                session.setClassRoom(classRoom);
                session.setSequenceNumber(seq);
                session.setTopic("Buổi " + seq);
                session.setSessionDate(currentDate);
                session.setStartTime(matchedSchedule.getStartTime());
                session.setEndTime(matchedSchedule.getEndTime());
                session.setStatus(ClassSessionStatus.SCHEDULED);

                ClassSession savedSession = classSessionRepository.save(session);
                createAttendancesForEnrolledStudents(savedSession, classRoom);
                nextBatch.add(savedSession);
                seq++;
            }
            currentDate = currentDate.plusDays(1);
        }

        log.info("Generated {} next batch sessions for ClassRoom {}", nextBatch.size(), classroomId);
        return nextBatch;
    }

    private void createAttendancesForEnrolledStudents(ClassSession session, ClassRoom classRoom) {
        List<EnrollmentRequest> enrolledRequests = enrollmentRequestRepository.findByClassRoomIdAndStatus(
                classRoom.getId(), EnrollmentRequestStatus.ENROLLED);

        // Fallback: If no ENROLLED yet, check ACCEPTED (students who reserved)
        if (enrolledRequests.isEmpty()) {
            enrolledRequests = enrollmentRequestRepository.findByClassRoomIdAndStatus(
                    classRoom.getId(), EnrollmentRequestStatus.ACCEPTED);
        }

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

    /**
     * Map Java standard DayOfWeek (MONDAY=1 ... SUNDAY=7) to EduConnect convention (2=Mon ... 8=Sun)
     */
    private int toProjectDayOfWeek(DayOfWeek dayOfWeek) {
        return dayOfWeek.getValue() + 1;
    }
}
