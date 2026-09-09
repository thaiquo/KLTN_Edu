package iuh.fit.notification_service.messaging.event;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

public record TutorApprovedEvent(
        String eventId,
        Long applicationId,
        Long tutorProfileId,
        Long userId,
        Set<SubjectItem> subjects,
        LocalDateTime occurredAt
) {
    public record SubjectItem(
            Long subjectId,
            Set<String> levels,
            BigDecimal oneToOneHourlyRate,
            Integer experienceYears,
            String description
    ) {
    }
}
