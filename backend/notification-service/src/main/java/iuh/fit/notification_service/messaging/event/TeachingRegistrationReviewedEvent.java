package iuh.fit.notification_service.messaging.event;

import java.time.LocalDateTime;

public record TeachingRegistrationReviewedEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long registrationId,
        Long recipientUserId,
        String tutorEmail,
        Long tutorProfileId,
        Long reviewerUserId,
        String reviewerEmail,
        Long subjectId,
        String subjectName,
        String reviewStatus,
        String rejectReason,
        String referenceType,
        String referenceId
) {
}
