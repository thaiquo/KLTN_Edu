package iuh.fit.notification_service.messaging.event;

import java.time.LocalDateTime;

public record EnrollmentNotificationEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long enrollmentRequestId,
        Long classId,
        Long recipientUserId,
        Long actorUserId,
        String classTitle,
        String reviewStatus,
        String rejectReason,
        String studentName
) {
}
