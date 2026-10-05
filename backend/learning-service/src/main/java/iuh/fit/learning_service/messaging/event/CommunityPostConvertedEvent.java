package iuh.fit.learning_service.messaging.event;

import java.time.LocalDateTime;

public record CommunityPostConvertedEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long postId,
        Long classId,
        Long recipientUserId,
        Long actorUserId,
        String postTitle,
        String classTitle,
        String tutorName,
        String referenceType,
        String referenceId
) {
}
