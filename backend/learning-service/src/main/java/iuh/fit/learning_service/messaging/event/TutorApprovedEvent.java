package iuh.fit.learning_service.messaging.event;

import iuh.fit.learning_service.enums.TeachingLevel;
import iuh.fit.learning_service.enums.TeachingMode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

public record TutorApprovedEvent(
        String eventId,
        Long applicationId,
        Long tutorProfileId,
        Long userId,
        Set<TeachingMode> teachingModes,
        Set<SubjectItem> subjects,
        LocalDateTime occurredAt
) {
    public record SubjectItem(
            Long subjectId,
            Set<TeachingLevel> levels,
            BigDecimal oneToOneHourlyRate,
            Integer experienceYears,
            String description
    ) {
    }
}
