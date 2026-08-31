package iuh.fit.notification_service.dto;

import iuh.fit.notification_service.enums.NotificationStatus;
import iuh.fit.notification_service.enums.NotificationType;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationDto {
    private UUID id;
    private String recipientEmail;
    private Long recipientId;
    private String title;
    private String content;
    private NotificationType type;
    private String referenceType;
    private String referenceId;
    private NotificationStatus status;
    private boolean isRead;
    private OffsetDateTime createdAt;
    private OffsetDateTime readAt;
    private String metadataJson;
}
