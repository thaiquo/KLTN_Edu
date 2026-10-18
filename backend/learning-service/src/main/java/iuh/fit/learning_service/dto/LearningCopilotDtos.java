package iuh.fit.learning_service.dto;

import java.time.LocalDate;
import java.util.List;

public final class LearningCopilotDtos {
    private LearningCopilotDtos() {
    }

    public record LessonContextResponse(
            Long classId,
            Long sessionId,
            String className,
            String classDescription,
            String subject,
            String level,
            String learningMode,
            Integer sessionsPerWeek,
            Integer durationPerSessionMinutes,
            List<ScheduleItem> schedules,
            List<ChapterItem> chapters,
            LessonSessionItem currentSession,
            List<LessonSessionItem> previousSessions,
            Integer studentCount,
            List<String> warnings
    ) {
    }

    /**
     * Trusted homework metadata for the feedback-writing assistant. Submission files are
     * intentionally excluded: this phase does not extract or inspect their content.
     */
    public record HomeworkFeedbackContextResponse(
            Long classId,
            Long sessionId,
            Long attendanceId,
            String homeworkTitle,
            String homeworkDescription,
            String subject,
            String level
    ) {
    }

    public record ScheduleItem(
            Integer dayOfWeek,
            String startTime,
            String endTime
    ) {
    }

    public record ChapterItem(
            String title,
            String description,
            Integer expectedSessions,
            Integer orderIndex
    ) {
    }

    public record LessonSessionItem(
            Long sessionId,
            Integer sequenceNumber,
            String topic,
            LocalDate sessionDate,
            String startTime,
            String endTime,
            String status,
            String assignmentTitle,
            String assignmentDescription
    ) {
    }
}
