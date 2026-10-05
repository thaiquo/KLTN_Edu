package iuh.fit.notification_service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendMessageRequest {

    private UUID conversationId;

    private Long recipientUserId;

    /**
     * Deprecated compatibility alias for old clients. Server-side recipient
     * identity is resolved by user id, never by email.
     */
    private Long recipientId;

    private String recipientEmail;

    @NotBlank(message = "Message content cannot be blank")
    @Size(max = 3000, message = "Message content must be at most 3000 characters")
    private String content;
}
