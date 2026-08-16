package iuh.fit.learning_service.messaging.event;

import java.time.LocalDateTime;

public record SubjectRequestApprovedEvent(
        String eventId,
        Long subjectRequestId,
        Long requestedByUserId,
        Long approvedSubjectId,
        LocalDateTime occurredAt
) {
}
