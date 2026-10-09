package iuh.fit.ai_service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TutorMatchingDtos {
    private TutorMatchingDtos() {
    }

    public enum TeachingMode {
        ONLINE,
        OFFLINE
    }

    public record PreferredScheduleRequest(
            @NotNull(message = "dayOfWeek is required")
            @Min(value = 2, message = "dayOfWeek must be from 2 to 8")
            @Max(value = 8, message = "dayOfWeek must be from 2 to 8")
            Integer dayOfWeek,

            @NotBlank(message = "startTime is required")
            @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "startTime must use HH:mm")
            String startTime,

            @NotBlank(message = "endTime is required")
            @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "endTime must use HH:mm")
            String endTime
    ) {
        @AssertTrue(message = "startTime must be before endTime")
        public boolean isTimeRangeValid() {
            if (startTime == null || endTime == null) {
                return true;
            }
            try {
                return LocalTime.parse(startTime.trim()).isBefore(LocalTime.parse(endTime.trim()));
            } catch (DateTimeParseException ignored) {
                return true;
            }
        }
    }

    public record TutorMatchingRequest(
            @NotNull(message = "subjectId is required")
            Long subjectId,

            @NotNull(message = "levelId is required")
            Long levelId,

            @NotNull(message = "teachingMode is required")
            TeachingMode teachingMode,

            @DecimalMin(value = "0", message = "budgetMin must be non-negative")
            BigDecimal budgetMin,

            @DecimalMin(value = "0", message = "budgetMax must be non-negative")
            BigDecimal budgetMax,

            @Size(max = 32, message = "provinceCode is too long")
            String provinceCode,

            @Size(max = 32, message = "communeCode is too long")
            String communeCode,

            @Size(max = 12, message = "preferredSchedules supports at most 12 slots")
            List<@Valid PreferredScheduleRequest> preferredSchedules,

            @Size(max = 1200, message = "learningGoal supports at most 1200 characters")
            String learningGoal,

            @Size(max = 12, message = "weakTopics supports at most 12 items")
            List<@Size(max = 120, message = "weakTopics item is too long") String> weakTopics,

            @Size(max = 12, message = "tutorPreferences supports at most 12 items")
            List<@Size(max = 120, message = "tutorPreferences item is too long") String> tutorPreferences
    ) {
        @AssertTrue(message = "budgetMin must be less than or equal to budgetMax")
        public boolean isBudgetRangeValid() {
            return budgetMin == null || budgetMax == null || budgetMin.compareTo(budgetMax) <= 0;
        }

        @AssertTrue(message = "provinceCode is required when communeCode is provided")
        public boolean isCommuneScopedByProvince() {
            return !hasText(communeCode) || hasText(provinceCode);
        }
    }

    public record TutorMatchingResponse(
            MatchingInputEcho input,
            int totalCandidates,
            int eligibleCandidates,
            List<String> relaxedCriteria,
            List<TutorMatchResult> results
    ) {
    }

    public record MatchingInputEcho(
            Long subjectId,
            Long levelId,
            TeachingMode teachingMode,
            BigDecimal budgetMin,
            BigDecimal budgetMax,
            String provinceCode,
            String communeCode,
            List<PreferredScheduleRequest> preferredSchedules,
            String learningGoal,
            List<String> weakTopics,
            List<String> tutorPreferences
    ) {
    }

    public record TutorMatchResult(
            Long tutorId,
            Long userId,
            String fullName,
            String avatarUrl,
            String bio,
            SafeLocation location,
            Set<String> teachingModes,
            MatchedSubject matchedSubject,
            BigDecimal startingTuition,
            List<AvailabilitySlot> availability,
            Double averageRating,
            Long reviewCount,
            Long publishedClassCount,
            int matchPercentage,
            ScoreBreakdown scoreBreakdown,
            List<String> matchingReasons,
            List<String> mismatchReasons,
            List<String> missingData,
            List<String> relaxedCriteria
    ) {
    }

    public record SafeLocation(
            String provinceCode,
            String provinceName,
            String communeCode,
            String communeName,
            String district
    ) {
    }

    public record MatchedSubject(
            Long registrationId,
            Long subjectId,
            String subjectName,
            Long levelId,
            String levelName,
            Long categoryId,
            String categoryName,
            Integer experienceYears,
            BigDecimal tuitionMin,
            BigDecimal tuitionMax,
            String description
    ) {
    }

    public record AvailabilitySlot(
            Long id,
            Integer dayOfWeek,
            String startTime,
            String endTime
    ) {
    }

    public record ScoreBreakdown(
            ScoreComponent schedule,
            ScoreComponent budget,
            ScoreComponent location,
            ScoreComponent experience,
            ScoreComponent ratingConfidence,
            SemanticScoreComponent semantic,
            BigDecimal rawScore,
            Map<String, Integer> weights,
            List<CriterionScore> criteria,
            BigDecimal totalWeight
    ) {
    }

    public record CriterionScore(
            String criterion,
            String label,
            String requested,
            String evidence,
            int weight,
            double normalizedScore,
            BigDecimal contribution,
            String status,
            String policy
    ) {
    }

    public record SemanticScoreComponent(
            boolean applicable,
            boolean used,
            Double normalizedSignal,
            BigDecimal rankBoost,
            String policy
    ) {
    }

    public record ScoreComponent(
            int weight,
            double normalizedScore,
            BigDecimal weightedScore,
            String policy
    ) {
    }

    public record TutorSearchPage(
            List<TutorCandidate> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean last
    ) {
    }

    public record TutorCandidate(
            Long tutorId,
            Long userId,
            String fullName,
            String avatarUrl,
            String bio,
            boolean approvedOrVerified,
            SafeLocation location,
            Set<String> teachingModes,
            List<SubjectCapability> subjects,
            BigDecimal startingTuition,
            List<AvailabilitySlot> availability,
            Double averageRating,
            Long reviewCount,
            Long publishedClassCount,
            LocalDateTime createdAt
    ) {
    }

    public record SubjectCapability(
            Long registrationId,
            Long subjectId,
            String subjectName,
            Long categoryId,
            String categoryName,
            List<Level> levels,
            Integer experienceYears,
            BigDecimal tuitionMin,
            BigDecimal tuitionMax,
            String description
    ) {
    }

    public record Level(
            Long levelId,
            String levelName
    ) {
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
