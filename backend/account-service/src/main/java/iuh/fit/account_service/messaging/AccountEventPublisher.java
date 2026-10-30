package iuh.fit.account_service.messaging;

import iuh.fit.account_service.messaging.event.TutorApplicationSubmittedEvent;
import iuh.fit.account_service.messaging.event.TutorApprovedEvent;
import iuh.fit.account_service.messaging.event.TutorRejectedEvent;
import iuh.fit.account_service.service.StaffNotificationRecipientResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

@Component
public class AccountEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(AccountEventPublisher.class);
    private final RabbitTemplate rabbitTemplate;
    private final StaffNotificationRecipientResolver staffRecipientResolver;

    public AccountEventPublisher(RabbitTemplate rabbitTemplate, StaffNotificationRecipientResolver staffRecipientResolver) {
        this.rabbitTemplate = rabbitTemplate;
        this.staffRecipientResolver = staffRecipientResolver;
    }

    public void publishTutorApplicationSubmitted(TutorApplicationSubmittedEvent event) {
        publishAfterCommit(() -> {
            List<Long> staffUserIds = staffRecipientResolver.activeStaffUserIds();
            for (Long staffUserId : staffUserIds) {
                if (staffUserId == null || staffUserId.equals(event.userId())) continue;
                send(AccountRabbitConfig.TUTOR_APPLICATION_SUBMITTED_ROUTING_KEY,
                        new TutorApplicationSubmittedEvent(event.eventId(), event.applicationId(), event.userId(),
                                staffUserId, event.occurredAt()));
            }
        }, event.eventId());
    }

    public void publishTutorApproved(TutorApprovedEvent event) {
        publishAfterCommit(() -> send(AccountRabbitConfig.TUTOR_APPROVED_ROUTING_KEY, event), event.eventId());
    }

    public void publishTutorRejected(TutorRejectedEvent event) {
        publishAfterCommit(() -> send(AccountRabbitConfig.TUTOR_REJECTED_ROUTING_KEY, event), event.eventId());
    }

    private void send(String routingKey, Object event) {
        rabbitTemplate.convertAndSend(AccountRabbitConfig.EXCHANGE, routingKey, event);
    }

    private void publishAfterCommit(Runnable action, String eventId) {
        Runnable loggedAction = () -> {
            try {
                action.run();
            } catch (RuntimeException ex) {
                log.error("Failed to publish account event eventId={}", eventId, ex);
            }
        };
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    loggedAction.run();
                }
            });
        } else {
            loggedAction.run();
        }
    }
}
