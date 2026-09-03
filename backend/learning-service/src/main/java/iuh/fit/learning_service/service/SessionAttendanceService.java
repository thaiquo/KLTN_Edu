package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.ClassSessionDtos;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.SessionAttendance;
import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionAttendanceService {

    private final ClassSessionRepository classSessionRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;
    private final ClassRoomRepository classRoomRepository;
    private final RollingSessionService rollingSessionService;

    /**
     * Lấy danh sách các buổi học của một lớp học. Tự động sinh tuần đầu tiên nếu lớp chưa có buổi học nào.
     */
    @Transactional
    public List<ClassSessionDtos.ClassSessionResponse> getSessionsByClassRoomId(Long classRoomId) {
        List<ClassSession> sessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classRoomId);
        if (sessions.isEmpty()) {
            try {
                sessions = rollingSessionService.generateInitialWeekSessions(classRoomId);
            } catch (Exception e) {
                log.warn("Auto-generation of initial week sessions for ClassRoom #{} failed: {}", classRoomId, e.getMessage());
                sessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classRoomId);
            }
        }
        return sessions.stream().map(this::toSessionResponse).toList();
    }

    /**
     * Chủ động sinh danh sách các buổi học của tuần đầu tiên cho lớp học.
     */
    @Transactional
    public List<ClassSessionDtos.ClassSessionResponse> generateInitialWeekSessions(Long classRoomId) {
        rollingSessionService.generateInitialWeekSessions(classRoomId);
        List<ClassSession> sessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classRoomId);
        return sessions.stream().map(this::toSessionResponse).toList();
    }

    /**
     * Lấy chi tiết một buổi học.
     */
    @Transactional(readOnly = true)
    public ClassSessionDtos.ClassSessionResponse getSessionById(Long sessionId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));
        return toSessionResponse(session);
    }

    /**
     * Gia sư lấy danh sách điểm danh chi tiết của toàn bộ học viên trong buổi học.
     */
    @Transactional(readOnly = true)
    public List<ClassSessionDtos.SessionAttendanceResponse> getAttendancesBySessionId(Long sessionId, String userEmail) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        List<SessionAttendance> attendances = sessionAttendanceRepository.findBySessionId(sessionId);
        return attendances.stream().map(this::toAttendanceResponse).toList();
    }

    /**
     * Gia sư cập nhật chủ đề, bài tập hoặc file tài liệu cho buổi học.
     */
    @Transactional
    public ClassSessionDtos.ClassSessionResponse updateSessionDetails(
            Long sessionId,
            String tutorEmail,
            ClassSessionDtos.UpdateSessionDetailsRequest request
    ) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        ClassRoom classRoom = session.getClassRoom();
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail.trim())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa buổi học của lớp này");
        }

        if (request.topic() != null) {
            session.setTopic(request.topic().trim());
        }
        if (request.assignmentTitle() != null) {
            session.setAssignmentTitle(request.assignmentTitle().trim());
        }
        if (request.assignmentDescription() != null) {
            session.setAssignmentDescription(request.assignmentDescription().trim());
        }
        if (request.assignmentFileUrl() != null) {
            session.setAssignmentFileUrl(request.assignmentFileUrl().trim());
        }

        ClassSession saved = classSessionRepository.save(session);
        return toSessionResponse(saved);
    }

    /**
     * Gia sư cập nhật link phòng học cố định cho toàn bộ Lớp học.
     */
    @Transactional
    public void updateClassMeetingLink(Long classRoomId, String tutorEmail, String meetingLink) {
        ClassRoom classRoom = classRoomRepository.findById(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Lớp học không tồn tại: " + classRoomId));

        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail.trim())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa link phòng học của lớp này");
        }

        if (meetingLink == null || meetingLink.trim().isEmpty()) {
            throw new BadRequestException("Link phòng học không được để trống");
        }

        classRoom.setMeetingLink(meetingLink.trim());
        classRoomRepository.save(classRoom);
        log.info("Tutor {} updated meeting link for ClassRoom #{} to {}", tutorEmail, classRoomId, meetingLink);
    }

    /**
     * Học viên tự bấm Check-in điểm danh vào học bất kỳ thời điểm nào TRONG KHUNG GIỜ HỌC [start_time, end_time].
     */
    @Transactional
    public ClassSessionDtos.SessionAttendanceResponse studentCheckIn(Long sessionId, Long studentId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        validateStrictSessionTimeWindow(session);

        SessionAttendance attendance = sessionAttendanceRepository.findBySessionIdAndStudentId(sessionId, studentId)
                .orElseThrow(() -> new BadRequestException("Bạn không có tên trong danh sách lớp học của buổi này"));

        if (Boolean.TRUE.equals(attendance.getStudentChecked())) {
            return toAttendanceResponse(attendance);
        }

        attendance.setStudentChecked(true);
        attendance.setStudentCheckedAt(LocalDateTime.now());
        SessionAttendance saved = sessionAttendanceRepository.save(attendance);

        if (session.getStatus() == ClassSessionStatus.SCHEDULED) {
            session.setStatus(ClassSessionStatus.IN_PROGRESS);
            classSessionRepository.save(session);
        }

        log.info("Student #{} checked-in successfully for Session #{} ({})", studentId, sessionId, session.getTopic());
        return toAttendanceResponse(saved);
    }

    /**
     * Gia sư bấm "Điểm danh vào dạy" bất kỳ lúc nào TRONG KHUNG GIỜ HỌC.
     * Ghi nhận gia sư đã vào dạy (tutorChecked = true) và hỗ trợ điểm danh hộ nếu học viên không tự bấm được.
     */
    @Transactional
    public ClassSessionDtos.ClassSessionResponse tutorCheckIn(
            Long sessionId,
            String tutorEmail,
            ClassSessionDtos.TutorAttendanceRequest request
    ) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        ClassRoom classRoom = session.getClassRoom();
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail.trim())) {
            throw new ForbiddenException("Bạn không có quyền điểm danh lớp học này");
        }

        validateStrictSessionTimeWindow(session);

        List<SessionAttendance> attendances = sessionAttendanceRepository.findBySessionId(sessionId);
        List<Long> presentList = request != null && request.presentStudentIds() != null
                ? request.presentStudentIds() : List.of();

        LocalDateTime now = LocalDateTime.now();

        for (SessionAttendance att : attendances) {
            att.setTutorChecked(true);
            if (att.getTutorCheckedAt() == null) {
                att.setTutorCheckedAt(now);
            }

            // Nếu gia sư điểm danh hộ cho học viên (hoặc học viên đã tự check-in)
            if (presentList.contains(att.getStudentId())) {
                att.setStudentChecked(true);
                if (att.getStudentCheckedAt() == null) {
                    att.setStudentCheckedAt(now);
                }
            }

            sessionAttendanceRepository.save(att);
        }

        if (session.getStatus() == ClassSessionStatus.SCHEDULED) {
            session.setStatus(ClassSessionStatus.IN_PROGRESS);
            session = classSessionRepository.save(session);
        }

        log.info("Tutor {} checked-in to teach Session #{} ({})", tutorEmail, sessionId, session.getTopic());
        return toSessionResponse(session);
    }

    /**
     * HỆ THỐNG TỰ ĐỘNG CHỐT BUỔI HỌC DỰA TRÊN THỜI GIAN KẾT THÚC THỰC TẾ (endTime).
     * Được gọi định kỳ bởi ClassroomLifecycleScheduler mỗi 1 phút.
     */
    @Transactional
    public void autoFinalizePastDueSessions() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        List<ClassSession> activeSessions = classSessionRepository.findAll().stream()
                .filter(s -> s.getStatus() == ClassSessionStatus.SCHEDULED || s.getStatus() == ClassSessionStatus.IN_PROGRESS)
                .filter(s -> s.getSessionDate() != null && s.getEndTime() != null)
                .filter(s -> {
                    if (s.getSessionDate().isBefore(today)) return true;
                    if (s.getSessionDate().isEqual(today)) {
                        try {
                            LocalTime endTime = LocalTime.parse(s.getEndTime());
                            return !now.isBefore(endTime); // now >= endTime
                        } catch (Exception e) {
                            return false;
                        }
                    }
                    return false;
                })
                .toList();

        if (activeSessions.isEmpty()) {
            return;
        }

        for (ClassSession session : activeSessions) {
            try {
                List<SessionAttendance> attendances = sessionAttendanceRepository.findBySessionId(session.getId());
                for (SessionAttendance att : attendances) {
                    boolean tutorChecked = Boolean.TRUE.equals(att.getTutorChecked());
                    boolean studentChecked = Boolean.TRUE.equals(att.getStudentChecked());

                    if (tutorChecked && studentChecked) {
                        att.setFinalOutcome(AttendanceOutcome.BOTH_PRESENT);
                    } else if (tutorChecked && !studentChecked) {
                        att.setFinalOutcome(AttendanceOutcome.STUDENT_ABSENT_TUTOR_PRESENT);
                    } else {
                        // Gia sư không điểm danh trong giờ học -> Gia sư vắng
                        att.setFinalOutcome(AttendanceOutcome.TUTOR_ABSENT);
                    }
                    sessionAttendanceRepository.save(att);
                }

                session.setStatus(ClassSessionStatus.COMPLETED);
                classSessionRepository.save(session);

                log.info("Auto-finalized Session #{} for ClassRoom #{} after reaching endTime {}. Outcomes resolved.",
                        session.getId(), session.getClassRoom().getId(), session.getEndTime());

                // Tự động sinh cuốn chiếu đợt tiếp theo nếu cần
                try {
                    rollingSessionService.generateNextBatchIfNeeded(session.getClassRoom().getId());
                } catch (Exception e) {
                    log.warn("Auto rolling generation failed after auto-finalizing session #{}: {}", session.getId(), e.getMessage());
                }
            } catch (Exception e) {
                log.error("Failed to auto-finalize Session #{}: {}", session.getId(), e.getMessage(), e);
            }
        }
    }

    /**
     * Kiểm tra nghiêm ngặt thời gian điểm danh: CHỈ CHO PHÉP TRONG ĐÚNG KHUNG GIỜ [start_time, end_time] CỦA NGÀY HỌC.
     */
    private void validateStrictSessionTimeWindow(ClassSession session) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        if (!session.getSessionDate().isEqual(today)) {
            if (session.getSessionDate().isAfter(today)) {
                throw new BadRequestException(String.format(
                        "Chưa đến ngày học. Buổi học diễn ra vào ngày %s.", session.getSessionDate()));
            } else {
                throw new BadRequestException(String.format(
                        "Buổi học ngày %s đã kết thúc thời gian điểm danh.", session.getSessionDate()));
            }
        }

        LocalTime startTime = LocalTime.parse(session.getStartTime());
        LocalTime endTime = LocalTime.parse(session.getEndTime());

        if (now.isBefore(startTime)) {
            throw new BadRequestException(String.format(
                    "Chưa đến giờ học. Điểm danh chỉ mở trong khung giờ từ %s đến %s.",
                    session.getStartTime(), session.getEndTime()));
        }

        if (now.isAfter(endTime)) {
            throw new BadRequestException(String.format(
                    "Buổi học đã kết thúc lúc %s. Quá thời gian điểm danh.", session.getEndTime()));
        }
    }

    private ClassSessionDtos.ClassSessionResponse toSessionResponse(ClassSession session) {
        return toSessionResponse(session, null);
    }

    private ClassSessionDtos.ClassSessionResponse toSessionResponse(ClassSession session, Long studentId) {
        List<SessionAttendance> attendances = session.getAttendances() != null
                ? session.getAttendances() : sessionAttendanceRepository.findBySessionId(session.getId());

        int total = attendances.size();
        int present = (int) attendances.stream()
                .filter(a -> Boolean.TRUE.equals(a.getStudentChecked()) || a.getFinalOutcome() == AttendanceOutcome.BOTH_PRESENT)
                .count();

        Boolean myCheckedIn = null;
        if (studentId != null) {
            myCheckedIn = attendances.stream()
                    .anyMatch(a -> a.getStudentId().equals(studentId) && Boolean.TRUE.equals(a.getStudentChecked()));
        }

        return new ClassSessionDtos.ClassSessionResponse(
                session.getId(),
                session.getClassRoom().getId(),
                session.getSequenceNumber(),
                session.getTopic(),
                session.getSessionDate(),
                session.getStartTime(),
                session.getEndTime(),
                session.getAssignmentTitle(),
                session.getAssignmentDescription(),
                session.getAssignmentFileUrl(),
                session.getStatus(),
                session.getCreatedAt(),
                session.getUpdatedAt(),
                total,
                present,
                myCheckedIn
        );
    }

    private ClassSessionDtos.SessionAttendanceResponse toAttendanceResponse(SessionAttendance att) {
        return new ClassSessionDtos.SessionAttendanceResponse(
                att.getId(),
                att.getSession().getId(),
                att.getStudentId(),
                att.getStudentName(),
                att.getStudentEmail(),
                att.getTutorId(),
                att.getTutorChecked(),
                att.getTutorCheckedAt(),
                att.getStudentChecked(),
                att.getStudentCheckedAt(),
                att.getFinalOutcome()
        );
    }
}
