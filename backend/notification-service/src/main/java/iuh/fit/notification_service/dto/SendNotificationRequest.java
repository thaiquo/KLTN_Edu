package iuh.fit.notification_service.dto;

import iuh.fit.notification_service.enums.NotificationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendNotificationRequest {

    @NotBlank(message = "Recipient email is required")
    private String recipientEmail;

    private Long recipientId;

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Content is required")
    private String content;

    @NotNull(message = "Notification type is required")
    private NotificationType type;

    private String referenceType;
    private String referenceId;
    private String metadataJson;
}
