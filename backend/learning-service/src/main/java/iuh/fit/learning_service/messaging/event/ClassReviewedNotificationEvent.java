package iuh.fit.learning_service.messaging.event;

import java.time.LocalDateTime;

public record ClassReviewedNotificationEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long classId,
        Long recipientUserId,
        String tutorEmail,
        String classTitle,
        String reviewStatus,
        String rejectReason,
        String reviewedByEmail
) {
}
