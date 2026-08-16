package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.TeachingLevel;

import java.math.BigDecimal;
import java.util.Set;

public final class TutorSubjectDtos {
    private TutorSubjectDtos() {
    }

    public record Response(
            Long tutorProfileId,
            Long subjectId,
            String subjectName,
            String subjectCategoryName,
            String subjectGroupName,
            Set<TeachingLevel> levels,
            BigDecimal oneToOneHourlyRate,
            Integer experienceYears,
            String description
    ) {
    }
}
