package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.TeachingMode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public final class TutorSearchDataDtos {
    private TutorSearchDataDtos() {
    }

    public record TutorSearchDataResponse(
            Long tutorProfileId,
            Long userId,
            Set<TeachingMode> teachingModes,
            List<CapabilityResponse> subjects,
            BigDecimal startingTuition,
            List<AvailabilitySlotResponse> availability,
            Double averageRating,
            long reviewCount,
            long publishedClassCount,
            LocalDateTime authorizationUpdatedAt
    ) {
    }

    public record CapabilityResponse(
            Long registrationId,
            Long subjectId,
            String subjectName,
            Long categoryId,
            String categoryName,
            List<LevelResponse> levels,
            Integer experienceYears,
            BigDecimal tuitionMin,
            BigDecimal tuitionMax,
            String description
    ) {
    }

    public record LevelResponse(
            Long levelId,
            String levelName
    ) {
    }

    public record AvailabilitySlotResponse(
            Long id,
            Integer dayOfWeek,
            String startTime,
            String endTime
    ) {
    }
}
