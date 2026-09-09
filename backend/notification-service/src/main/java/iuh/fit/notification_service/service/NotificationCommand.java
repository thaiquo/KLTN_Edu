package iuh.fit.notification_service.service;

public record NotificationCommand(
        String eventId,
        Long recipientUserId,
        String type,
        String title,
        String message,
        String targetRole,
        String referenceType,
        String referenceId
) {
}
