package iuh.fit.ai_service.dto;

import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundedClassRequirement;
import iuh.fit.ai_service.dto.TutorMatchingDtos.ScoreComponent;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SemanticScoreComponent;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class ClassMatchingDtos {
    private ClassMatchingDtos() {
    }

    public record ClassMatchingRequest(
            @Valid @NotNull(message = "requirement is required")
            GroundedClassRequirement requirement,

            @Min(value = 1, message = "topK must be at least 1")
            @Max(value = 50, message = "topK must be at most 50")
            Integer topK
    ) {
    }

    public record ClassMatchingResponse(
            GroundedClassRequirement input,
            int totalCandidates,
            int eligibleCandidates,
            String rankingMode,
            List<ClassMatchResult> results
    ) {
    }

    public record ClassMatchResult(
            Long classId,
            Long tutorSubjectRegistrationId,
            Long tutorProfileId,
            String tutorFullName,
            String name,
            String description,
            TeachingMode teachingMode,
            String address,
            MatchedClassSubject subject,
            MatchedClassLevel level,
            BigDecimal pricePerSession,
            Integer sessionsPerWeek,
            Integer durationPerSessionMinutes,
            LocalDate startDate,
            LocalDate endDate,
            Integer totalSessions,
            Long availableSlots,
            Double averageRating,
            Long reviewCount,
            List<ClassSchedule> schedules,
            List<String> topicChips,
            int matchPercentage,
            ClassScoreBreakdown scoreBreakdown,
            List<String> matchingReasons,
            List<String> missingData
    ) {
    }

    public record MatchedClassSubject(
            Long subjectId,
            String subjectName,
            Long categoryId,
            String categoryName
    ) {
    }

    public record MatchedClassLevel(
            Long levelId,
            String levelName
    ) {
    }

    public record ClassSchedule(
            Long id,
            Integer dayOfWeek,
            String startTime,
            String endTime
    ) {
    }

    public record ClassScoreBreakdown(
            ScoreComponent schedule,
            ScoreComponent budget,
            ScoreComponent startTiming,
            ScoreComponent capacity,
            ScoreComponent ratingConfidence,
            SemanticScoreComponent semantic,
            BigDecimal rawScore,
            Map<String, Integer> weights
    ) {
    }

    public record PublicClassSearchPage(
            List<PublicClassCard> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            String sort
    ) {
    }

    public record PublicClassSemanticSourceResponse(
            List<PublicClassSource> content
    ) {
    }

    public record PublicClassSource(
            Long id,
            Long tutorSubjectRegistrationId,
            RegistrationBrief registration,
            LevelBrief level,
            Long tutorProfileId,
            String tutorFullName,
            String name,
            String description,
            TeachingMode learningMode,
            String address,
            Integer maxStudents,
            Long acceptedCount,
            Long availableSlots,
            Boolean isBufferPoolFull,
            BigDecimal pricePerSession,
            BigDecimal totalPrice,
            Integer sessionsPerWeek,
            Integer durationPerSessionMinutes,
            LocalDate startDate,
            LocalDate endDate,
            Integer totalSessions,
            String joinMode,
            String status,
            Double averageRating,
            Long reviewCount,
            List<ClassSchedule> schedules,
            List<ChapterBrief> chapters,
            List<String> topicChips,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record PublicClassCard(
            Long id,
            Long tutorSubjectRegistrationId,
            RegistrationBrief registration,
            LevelBrief level,
            Long tutorProfileId,
            String tutorFullName,
            String name,
            String description,
            TeachingMode learningMode,
            String address,
            Integer maxStudents,
            Long acceptedCount,
            Long availableSlots,
            Boolean isBufferPoolFull,
            BigDecimal pricePerSession,
            BigDecimal totalPrice,
            Integer sessionsPerWeek,
            Integer durationPerSessionMinutes,
            LocalDate startDate,
            LocalDate endDate,
            Integer totalSessions,
            String joinMode,
            String status,
            Double averageRating,
            Long reviewCount,
            List<ClassSchedule> schedules,
            List<String> topicChips,
            LocalDateTime createdAt
    ) {
    }

    public record RegistrationBrief(
            Long id,
            Long programTypeId,
            String programTypeName,
            Long educationLevelId,
            String educationLevelName,
            Long categoryId,
            String categoryName,
            Long subjectId,
            String subjectName,
            String subjectCode,
            BigDecimal tuitionMin,
            BigDecimal tuitionMax
    ) {
    }

    public record LevelBrief(
            Long id,
            String name,
            String code
    ) {
    }

    public record ChapterBrief(
            Long id,
            String title,
            String description,
            Integer expectedSessions,
            Integer orderIndex
    ) {
    }
}
