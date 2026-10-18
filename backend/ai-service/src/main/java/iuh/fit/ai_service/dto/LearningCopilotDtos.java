package iuh.fit.ai_service.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class LearningCopilotDtos {
    private LearningCopilotDtos() {
    }

    public record LessonDraftRequest(
            @NotNull Long classId,
            @NotNull Long sessionId
    ) {
    }

    public record LessonDraftResponse(
            UUID draftId,
            String promptVersion,
            Instant generatedAt,
            LessonPlan lessonPlan,
            SourceSummary sourceSummary,
            List<String> warnings
    ) {
    }

    public record HomeworkFeedbackDraftRequest(
            @NotNull Long classId,
            @NotNull Long sessionId,
            @NotNull Long attendanceId,
            @Size(max = 50) String score,
            @Size(max = 3) List<@Size(max = 300) String> selectedFeedback,
            @Size(max = 2000) String tutorNotes
    ) {
    }

    public record HomeworkFeedbackDraftResponse(
            UUID draftId,
            String promptVersion,
            Instant generatedAt,
            HomeworkFeedback feedback,
            List<String> warnings
    ) {
    }

    public record HomeworkFeedback(
            String summary,
            List<String> strengths,
            List<String> improvements,
            List<String> nextSteps,
            String finalComment
    ) {
    }

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

    public record LessonPlan(
            String title,
            List<String> objectives,
            List<OutlineItem> outline,
            String warmup,
            List<String> practiceActivities,
            List<String> keyPoints,
            String homeworkSuggestion,
            String nextSessionSuggestion
    ) {
    }

    public record OutlineItem(
            String title,
            Integer durationMinutes,
            String description
    ) {
    }

    public record SourceSummary(
            Long classId,
            Long sessionId,
            String className,
            String subject,
            String level,
            String learningMode,
            Integer durationMinutes
    ) {
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

    public record ScheduleItem(Integer dayOfWeek, String startTime, String endTime) {
    }

    public record ChapterItem(String title, String description, Integer expectedSessions, Integer orderIndex) {
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
