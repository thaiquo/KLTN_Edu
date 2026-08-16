package iuh.fit.account_service.messaging.event;

import java.time.LocalDateTime;

public record TutorRejectedEvent(
        String eventId,
        Long applicationId,
        Long userId,
        String reason,
        LocalDateTime occurredAt
) {
}
