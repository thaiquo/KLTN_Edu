package iuh.fit.notification_service.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class NotificationDtos {
    private NotificationDtos() {
    }

    public record NotificationResponse(
            Long id,
            String type,
            String title,
            String message,
            String referenceType,
            String referenceId,
            String targetRole,
            boolean read,
            LocalDateTime readAt,
            LocalDateTime createdAt
    ) {
    }

    public record NotificationPageResponse(
            List<NotificationResponse> content,
            long totalElements,
            int totalPages,
            int page,
            int size
    ) {
    }

    public record UnreadCountResponse(long count) {
    }

    public record MarkAllReadResponse(int count) {
    }
}
