package iuh.fit.notification_service.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationDto {
    private UUID id;
    private Long participant1Id;
    private String participant1Email;
    private Long participant2Id;
    private String participant2Email;
    private String lastMessage;
    private OffsetDateTime lastMessageTime;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private long unreadCount;
}
