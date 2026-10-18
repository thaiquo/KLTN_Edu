package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.LearningCopilotDtos.ChapterItem;
import iuh.fit.learning_service.dto.LearningCopilotDtos.LessonContextResponse;
import iuh.fit.learning_service.dto.LearningCopilotDtos.HomeworkFeedbackContextResponse;
import iuh.fit.learning_service.dto.LearningCopilotDtos.LessonSessionItem;
import iuh.fit.learning_service.dto.LearningCopilotDtos.ScheduleItem;
import iuh.fit.learning_service.entity.CatalogLevel;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.SessionAttendance;
import iuh.fit.learning_service.entity.TutorSubjectRegistration;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class LearningCopilotContextService {
    private final ClassRoomRepository classRoomRepository;
    private final ClassSessionRepository classSessionRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;
    private final SessionAccessControl sessionAccessControl;

    @Transactional(readOnly = true)
    public LessonContextResponse lessonContext(Long classId, Long sessionId) {
        ClassRoom classRoom = classRoomRepository.findByIdWithDetails(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        sessionAccessControl.requireTutor(classRoom);

        ClassSession currentSession = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));
        if (!Objects.equals(currentSession.getClassRoom().getId(), classRoom.getId())) {
            throw new BadRequestException("Session does not belong to this class");
        }

        List<ClassSession> orderedSessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classId);
        List<LessonSessionItem> previousSessions = orderedSessions.stream()
                .filter(session -> session.getSequenceNumber() != null
                        && currentSession.getSequenceNumber() != null
                        && session.getSequenceNumber() < currentSession.getSequenceNumber())
                .sorted(Comparator.comparing(ClassSession::getSequenceNumber))
                .map(this::toSessionItem)
                .toList();

        List<String> warnings = new ArrayList<>();
        if (classRoom.getChapters() == null || classRoom.getChapters().isEmpty()) {
            warnings.add("Chưa có đủ mô tả chương học để gợi ý chi tiết.");
        }
        if (previousSessions.isEmpty()) {
            warnings.add("Chưa có buổi học trước đó để tham chiếu tiến độ.");
        }
        if (!StringUtils.hasText(currentSession.getTopic())) {
            warnings.add("Buổi học hiện tại chưa có chủ đề sẵn.");
        }

        return new LessonContextResponse(
                classRoom.getId(),
                currentSession.getId(),
                classRoom.getName(),
                classRoom.getDescription(),
                resolveSubject(classRoom),
                resolveLevel(classRoom),
                classRoom.getLearningMode() == null ? null : classRoom.getLearningMode().name(),
                classRoom.getSessionsPerWeek(),
                classRoom.getDurationPerSessionMinutes(),
                classRoom.getSchedules().stream().map(schedule -> new ScheduleItem(
                        schedule.getDayOfWeek(),
                        schedule.getStartTime(),
                        schedule.getEndTime()
                )).toList(),
                classRoom.getChapters().stream().map(chapter -> new ChapterItem(
                        chapter.getTitle(),
                        chapter.getDescription(),
                        chapter.getExpectedSessions(),
                        chapter.getOrderIndex()
                )).toList(),
                toSessionItem(currentSession),
                previousSessions,
                sessionAttendanceRepository.findBySessionId(currentSession.getId()).size(),
                warnings
        );
    }

    @Transactional(readOnly = true)
    public HomeworkFeedbackContextResponse homeworkFeedbackContext(Long classId, Long sessionId, Long attendanceId) {
        ClassRoom classRoom = classRoomRepository.findByIdWithDetails(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        sessionAccessControl.requireTutor(classRoom);

        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));
        if (!Objects.equals(session.getClassRoom().getId(), classRoom.getId())) {
            throw new BadRequestException("Session does not belong to this class");
        }

        SessionAttendance attendance = sessionAttendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Homework submission not found"));
        if (!Objects.equals(attendance.getSession().getId(), session.getId())) {
            throw new BadRequestException("Submission does not belong to this session");
        }
        if (attendance.getSubmittedAt() == null
                && !StringUtils.hasText(attendance.getSubmissionText())
                && !StringUtils.hasText(attendance.getSubmissionFileUrl())) {
            throw new BadRequestException("Student has not submitted homework");
        }

        return new HomeworkFeedbackContextResponse(
                classRoom.getId(),
                session.getId(),
                attendance.getId(),
                session.getAssignmentTitle(),
                session.getAssignmentDescription(),
                resolveSubject(classRoom),
                resolveLevel(classRoom)
        );
    }

    private LessonSessionItem toSessionItem(ClassSession session) {
        return new LessonSessionItem(
                session.getId(),
                session.getSequenceNumber(),
                session.getTopic(),
                session.getSessionDate(),
                session.getStartTime(),
                session.getEndTime(),
                session.getStatus() == null ? null : session.getStatus().name(),
                session.getAssignmentTitle(),
                session.getAssignmentDescription()
        );
    }

    private String resolveSubject(ClassRoom classRoom) {
        TutorSubjectRegistration registration = classRoom.getTutorSubjectRegistration();
        if (registration != null && registration.getSubject() != null) {
            return registration.getSubject().getName();
        }
        if (registration != null && StringUtils.hasText(registration.getProposedSubjectName())) {
            return registration.getProposedSubjectName();
        }
        CatalogLevel level = classRoom.getLevel();
        if (level != null && level.getSubject() != null) {
            return level.getSubject().getName();
        }
        return null;
    }

    private String resolveLevel(ClassRoom classRoom) {
        CatalogLevel level = classRoom.getLevel();
        return level == null ? null : level.getName();
    }
}
