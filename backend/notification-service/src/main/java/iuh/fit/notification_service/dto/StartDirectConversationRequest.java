package iuh.fit.notification_service.dto;

import jakarta.validation.constraints.NotNull;

public record StartDirectConversationRequest(
        @NotNull(message = "Recipient user id is required") Long recipientUserId
) {
}
