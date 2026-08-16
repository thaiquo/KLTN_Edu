package iuh.fit.learning_service.messaging;

import iuh.fit.learning_service.messaging.event.SubjectRequestApprovedEvent;
import iuh.fit.learning_service.messaging.event.SubjectRequestRejectedEvent;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
public class LearningEventPublisher {
    private final RabbitTemplate rabbitTemplate;

    public LearningEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishSubjectRequestApproved(Long requestId, Long requestedByUserId, Long approvedSubjectId) {
        rabbitTemplate.convertAndSend(
                LearningRabbitConfig.EXCHANGE,
                LearningRabbitConfig.SUBJECT_REQUEST_APPROVED_ROUTING_KEY,
                new SubjectRequestApprovedEvent(UUID.randomUUID().toString(), requestId, requestedByUserId, approvedSubjectId, LocalDateTime.now())
        );
    }

    public void publishSubjectRequestRejected(Long requestId, Long requestedByUserId, String reason) {
        rabbitTemplate.convertAndSend(
                LearningRabbitConfig.EXCHANGE,
                LearningRabbitConfig.SUBJECT_REQUEST_REJECTED_ROUTING_KEY,
                new SubjectRequestRejectedEvent(UUID.randomUUID().toString(), requestId, requestedByUserId, reason, LocalDateTime.now())
        );
    }
}
