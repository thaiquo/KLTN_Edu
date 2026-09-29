package iuh.fit.notification_service.messaging.event;

import java.time.LocalDateTime;

public record HomeworkNotificationEvent(
        String eventId,
        String eventType,
        LocalDateTime occurredAt,
        String producer,
        Long classId,
        Long sessionId,
        Long attendanceId,
        Long recipientUserId,
        Long actorUserId,
        String classTitle,
        String sessionTopic,
        Integer sequenceNumber,
        String studentName,
        String gradeScore,
        String referenceType,
        String referenceId
) {
}
