package iuh.fit.account_service.messaging;

import iuh.fit.account_service.messaging.event.TutorApplicationSubmittedEvent;
import iuh.fit.account_service.messaging.event.TutorApprovedEvent;
import iuh.fit.account_service.messaging.event.TutorRejectedEvent;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class AccountEventPublisher {
    private final RabbitTemplate rabbitTemplate;

    public AccountEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishTutorApplicationSubmitted(TutorApplicationSubmittedEvent event) {
        rabbitTemplate.convertAndSend(AccountRabbitConfig.EXCHANGE, AccountRabbitConfig.TUTOR_APPLICATION_SUBMITTED_ROUTING_KEY, event);
    }

    public void publishTutorApproved(TutorApprovedEvent event) {
        rabbitTemplate.convertAndSend(AccountRabbitConfig.EXCHANGE, AccountRabbitConfig.TUTOR_APPROVED_ROUTING_KEY, event);
    }

    public void publishTutorRejected(TutorRejectedEvent event) {
        rabbitTemplate.convertAndSend(AccountRabbitConfig.EXCHANGE, AccountRabbitConfig.TUTOR_REJECTED_ROUTING_KEY, event);
    }
}
