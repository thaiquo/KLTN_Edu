package iuh.fit.learning_service.messaging;

import iuh.fit.learning_service.messaging.event.SubjectRequestApprovedEvent;
import iuh.fit.learning_service.messaging.event.SubjectRequestRejectedEvent;
import iuh.fit.learning_service.messaging.event.EnrollmentNotificationEvent;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
public class LearningEventPublisher {
    private final RabbitTemplate rabbitTemplate;

    public LearningEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishSubjectRequestApproved(Long requestId, Long requestedByUserId, Long approvedSubjectId) {
        publishAfterCommit(
                LearningRabbitConfig.EXCHANGE,
                LearningRabbitConfig.SUBJECT_REQUEST_APPROVED_ROUTING_KEY,
                new SubjectRequestApprovedEvent(UUID.randomUUID().toString(), requestId, requestedByUserId, approvedSubjectId, LocalDateTime.now())
        );
    }

    public void publishSubjectRequestRejected(Long requestId, Long requestedByUserId, String reason) {
        publishAfterCommit(
                LearningRabbitConfig.EXCHANGE,
                LearningRabbitConfig.SUBJECT_REQUEST_REJECTED_ROUTING_KEY,
                new SubjectRequestRejectedEvent(UUID.randomUUID().toString(), requestId, requestedByUserId, reason, LocalDateTime.now())
        );
    }

    public void publishEnrollmentRequested(Long requestId, Long classId, Long recipientUserId, Long actorUserId, String classTitle, String studentName) {
        publishEnrollment(
                LearningRabbitConfig.ENROLLMENT_REQUESTED_ROUTING_KEY,
                "ENROLLMENT_REQUESTED",
                requestId,
                classId,
                recipientUserId,
                actorUserId,
                classTitle,
                "PENDING",
                null,
                studentName
        );
    }

    public void publishEnrollmentAccepted(Long requestId, Long classId, Long recipientUserId, Long actorUserId, String classTitle, String studentName) {
        publishEnrollment(
                LearningRabbitConfig.ENROLLMENT_ACCEPTED_ROUTING_KEY,
                "ENROLLMENT_ACCEPTED",
                requestId,
                classId,
                recipientUserId,
                actorUserId,
                classTitle,
                "ACCEPTED",
                null,
                studentName
        );
    }

    public void publishEnrollmentRejected(Long requestId, Long classId, Long recipientUserId, Long actorUserId, String classTitle, String reason, String studentName) {
        publishEnrollment(
                LearningRabbitConfig.ENROLLMENT_REJECTED_ROUTING_KEY,
                "ENROLLMENT_REJECTED",
                requestId,
                classId,
                recipientUserId,
                actorUserId,
                classTitle,
                "REJECTED",
                reason,
                studentName
        );
    }

    public void publishEnrollmentCancelled(Long requestId, Long classId, Long recipientUserId, Long actorUserId, String classTitle, String studentName) {
        publishEnrollment(
                LearningRabbitConfig.ENROLLMENT_CANCELLED_ROUTING_KEY,
                "ENROLLMENT_CANCELLED",
                requestId,
                classId,
                recipientUserId,
                actorUserId,
                classTitle,
                "CANCELLED",
                null,
                studentName
        );
    }

    private void publishEnrollment(
            String routingKey,
            String eventType,
            Long requestId,
            Long classId,
            Long recipientUserId,
            Long actorUserId,
            String classTitle,
            String reviewStatus,
            String rejectReason,
            String studentName
    ) {
        if (recipientUserId == null || (actorUserId != null && actorUserId.equals(recipientUserId))) {
            return;
        }
        publishAfterCommit(
                LearningRabbitConfig.EXCHANGE,
                routingKey,
                new EnrollmentNotificationEvent(
                        UUID.randomUUID().toString(),
                        eventType,
                        LocalDateTime.now(),
                        "learning-service",
                        requestId,
                        classId,
                        recipientUserId,
                        actorUserId,
                        classTitle,
                        reviewStatus,
                        rejectReason,
                        studentName
                )
        );
    }

    private void publishAfterCommit(String exchange, String routingKey, Object event) {
        Runnable action = () -> rabbitTemplate.convertAndSend(exchange, routingKey, event);
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
