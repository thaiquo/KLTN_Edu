package iuh.fit.ai_service.dto;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public final class RequirementAnalysisDtos {
    private RequirementAnalysisDtos() {
    }

    public static final int MESSAGE_MIN_LENGTH = 10;
    public static final int MESSAGE_MAX_LENGTH = 3000;

    public enum ExtractionStatus {
        EXTRACTED,
        NEEDS_CLARIFICATION,
        INVALID
    }

    public enum TimeOfDayHint {
        MORNING,
        AFTERNOON,
        EVENING,
        NIGHT
    }

    public record AnalyzeRequirementRequest(
            @NotBlank(message = "message is required")
            @Size(
                    min = MESSAGE_MIN_LENGTH,
                    max = MESSAGE_MAX_LENGTH,
                    message = "message must be between 10 and 3000 characters"
            )
            String message
    ) {
    }

    public record AnalyzeRequirementResponse(
            ExtractionStatus status,
            ExtractedRequirement requirement,
            List<String> missingRequiredFields,
            List<String> ambiguousFields
    ) {
    }

    public record ExtractedRequirement(
            String subjectHint,
            String levelHint,
            TeachingMode teachingMode,
            Budget budget,
            List<PreferredSchedule> preferredSchedules,
            String learningGoal,
            List<String> weakTopics,
            List<String> tutorPreferences,
            String locationHint
    ) {
    }

    public record Budget(
            BigDecimal min,
            BigDecimal max,
            BigDecimal target,
            String currency,
            String unit,
            Boolean approximate
    ) {
    }

    public record PreferredSchedule(
            Integer dayOfWeek,
            String startTime,
            String endTime,
            TimeOfDayHint timeOfDayHint
    ) {
    }

    public record GeminiRequirementExtraction(
            Boolean tutorSearchRelevant,
            String subjectHint,
            String levelHint,
            TeachingMode teachingMode,
            Budget budget,
            List<PreferredSchedule> preferredSchedules,
            String learningGoal,
            List<String> weakTopics,
            List<String> tutorPreferences,
            String locationHint,
            List<String> ambiguousFields
    ) {
    }
}
