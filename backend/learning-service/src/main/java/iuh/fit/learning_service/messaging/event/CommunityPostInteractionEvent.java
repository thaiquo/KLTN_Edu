package iuh.fit.learning_service.messaging.event;

import java.time.LocalDateTime;

public record CommunityPostInteractionEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long postId,
        Long commentId,
        Long recipientUserId,
        Long actorUserId,
        String actorName,
        String postTitle,
        String commentPreview,
        String targetRole,
        String referenceType,
        String referenceId
) {
}
