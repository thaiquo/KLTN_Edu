package iuh.fit.notification_service.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageDto {
    private UUID id;
    private UUID conversationId;
    private Long senderId;
    private String senderEmail;
    private Long recipientId;
    private String recipientEmail;
    private String content;
    private boolean isRead;
    private OffsetDateTime createdAt;
}
