package iuh.fit.ai_service.dto;

import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class ClassRequirementAnalysisDtos {
    private ClassRequirementAnalysisDtos() {
    }

    public static final int MESSAGE_MIN_LENGTH = 10;
    public static final int MESSAGE_MAX_LENGTH = 3000;

    public enum ExtractionStatus {
        EXTRACTED,
        NEEDS_CLARIFICATION,
        INVALID
    }

    public record AnalyzeClassRequirementRequest(
            @NotBlank(message = "message is required")
            @Size(
                    min = MESSAGE_MIN_LENGTH,
                    max = MESSAGE_MAX_LENGTH,
                    message = "message must be between 10 and 3000 characters"
            )
            String message
    ) {
    }

    public record AnalyzeClassRequirementResponse(
            ExtractionStatus status,
            ClassExtractedRequirement requirement,
            List<String> missingRequiredFields,
            List<String> ambiguousFields
    ) {
    }

    public record ClassExtractedRequirement(
            String subjectHint,
            String levelHint,
            TeachingMode teachingMode,
            Budget budget,
            List<PreferredSchedule> availableSchedules,
            String learningGoal,
            List<String> weakTopics,
            List<String> classPreferences,
            String locationHint
    ) {
    }

    public record ClassGeminiRequirementExtraction(
            Boolean classSearchRelevant,
            String subjectHint,
            String levelHint,
            TeachingMode teachingMode,
            Budget budget,
            List<PreferredSchedule> availableSchedules,
            String learningGoal,
            List<String> weakTopics,
            List<String> classPreferences,
            String locationHint,
            List<String> ambiguousFields
    ) {
    }
}
