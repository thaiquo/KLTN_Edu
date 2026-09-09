package iuh.fit.notification_service.realtime;

import java.time.LocalDateTime;

public record NotificationRealtimeEvent(
        String source,
        String eventType,
        Long notificationId,
        String notificationType,
        Long recipientUserId,
        String targetRole,
        String referenceType,
        String referenceId,
        String title,
        String message,
        LocalDateTime createdAt
) {
}
