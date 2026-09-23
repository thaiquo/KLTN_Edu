package iuh.fit.account_service.messaging;

import iuh.fit.account_service.messaging.event.TutorApplicationSubmittedEvent;
import iuh.fit.account_service.messaging.event.TutorApprovedEvent;
import iuh.fit.account_service.messaging.event.TutorRejectedEvent;
import iuh.fit.account_service.service.StaffNotificationRecipientResolver;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AccountEventPublisher {
    private final RabbitTemplate rabbitTemplate;
    private final StaffNotificationRecipientResolver staffRecipientResolver;

    public AccountEventPublisher(RabbitTemplate rabbitTemplate, StaffNotificationRecipientResolver staffRecipientResolver) {
        this.rabbitTemplate = rabbitTemplate;
        this.staffRecipientResolver = staffRecipientResolver;
    }

    public void publishTutorApplicationSubmitted(TutorApplicationSubmittedEvent event) {
        List<Long> staffUserIds = staffRecipientResolver.activeStaffUserIds();
        for (Long staffUserId : staffUserIds) {
            if (staffUserId == null || staffUserId.equals(event.userId())) {
                continue;
            }
            rabbitTemplate.convertAndSend(
                    AccountRabbitConfig.EXCHANGE,
                    AccountRabbitConfig.TUTOR_APPLICATION_SUBMITTED_ROUTING_KEY,
                    new TutorApplicationSubmittedEvent(
                            event.eventId(),
                            event.applicationId(),
                            event.userId(),
                            staffUserId,
                            event.occurredAt()
                    )
            );
        }
    }

    public void publishTutorApproved(TutorApprovedEvent event) {
        rabbitTemplate.convertAndSend(AccountRabbitConfig.EXCHANGE, AccountRabbitConfig.TUTOR_APPROVED_ROUTING_KEY, event);
    }

    public void publishTutorRejected(TutorRejectedEvent event) {
        rabbitTemplate.convertAndSend(AccountRabbitConfig.EXCHANGE, AccountRabbitConfig.TUTOR_REJECTED_ROUTING_KEY, event);
    }
}
