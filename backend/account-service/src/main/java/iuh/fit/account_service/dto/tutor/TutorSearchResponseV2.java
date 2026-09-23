package iuh.fit.account_service.dto.tutor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public record TutorSearchResponseV2(
        Long tutorId,
        Long userId,
        String fullName,
        String avatarUrl,
        String bio,
        boolean approvedOrVerified,
        LocationResponse location,
        Set<String> teachingModes,
        List<SubjectCapabilityResponse> subjects,
        BigDecimal startingTuition,
        List<AvailabilitySlotResponse> availability,
        Double averageRating,
        Long reviewCount,
        Long publishedClassCount,
        LocalDateTime createdAt
) {
    public record LocationResponse(
            String provinceCode,
            String provinceName,
            String communeCode,
            String communeName,
            String district
    ) {
    }

    public record SubjectCapabilityResponse(
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

    public record PageResponse(
            List<TutorSearchResponseV2> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean last
    ) {
    }
}
