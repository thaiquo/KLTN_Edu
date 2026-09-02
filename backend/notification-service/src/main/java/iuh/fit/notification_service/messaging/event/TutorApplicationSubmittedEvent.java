package iuh.fit.notification_service.messaging.event;

import java.time.LocalDateTime;

public record TutorApplicationSubmittedEvent(
        String eventId,
        Long applicationId,
        Long userId,
        LocalDateTime occurredAt
) {
}
