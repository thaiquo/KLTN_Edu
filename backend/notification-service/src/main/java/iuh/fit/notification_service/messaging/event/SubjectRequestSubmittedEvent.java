package iuh.fit.notification_service.messaging.event;

import java.time.LocalDateTime;

public record SubjectRequestSubmittedEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long subjectRequestId,
        Long recipientUserId,
        Long requestedByUserId,
        String requestedName,
        String referenceType,
        String referenceId
) {
}
