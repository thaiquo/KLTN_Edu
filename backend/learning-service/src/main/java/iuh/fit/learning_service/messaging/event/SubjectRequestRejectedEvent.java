package iuh.fit.learning_service.messaging.event;

import java.time.LocalDateTime;

public record SubjectRequestRejectedEvent(
        String eventId,
        Long subjectRequestId,
        Long requestedByUserId,
        String reason,
        LocalDateTime occurredAt
) {
}
