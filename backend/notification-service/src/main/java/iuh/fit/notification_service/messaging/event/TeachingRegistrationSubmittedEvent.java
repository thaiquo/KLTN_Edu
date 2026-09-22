package iuh.fit.notification_service.messaging.event;

import java.time.LocalDateTime;

public record TeachingRegistrationSubmittedEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long registrationId,
        Long recipientUserId,
        String tutorEmail,
        Long subjectId,
        String subjectName,
        String referenceType,
        String referenceId
) {
}
