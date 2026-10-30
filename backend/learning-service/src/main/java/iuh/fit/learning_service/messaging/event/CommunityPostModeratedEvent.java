package iuh.fit.learning_service.messaging.event;

import java.time.LocalDateTime;

public record CommunityPostModeratedEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long postId,
        Long recipientUserId,
        String targetRole,
        String postTitle,
        String decision,
        String reason,
        Long reviewerUserId,
        String referenceType,
        String referenceId
) {
}
