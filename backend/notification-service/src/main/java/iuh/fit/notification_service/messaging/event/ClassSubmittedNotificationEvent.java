package iuh.fit.notification_service.messaging.event;

import java.time.LocalDateTime;

public record ClassSubmittedNotificationEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long classId,
        Long recipientUserId,
        String tutorEmail,
        String classTitle,
        String referenceType,
        String referenceId
) {
}
