package iuh.fit.notification_service.dto;

public record MarkReadResponse(
        int updatedCount,
        long unreadCount
) {
}
