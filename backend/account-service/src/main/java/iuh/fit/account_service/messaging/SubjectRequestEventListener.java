package iuh.fit.account_service.messaging;

import iuh.fit.account_service.messaging.event.SubjectRequestApprovedEvent;
import iuh.fit.account_service.messaging.event.SubjectRequestRejectedEvent;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class SubjectRequestEventListener {
    @RabbitListener(queues = AccountRabbitConfig.SUBJECT_REQUEST_APPROVED_QUEUE)
    public void onApproved(SubjectRequestApprovedEvent event) {
        // Account keeps tutor applications independent from subject request ownership.
        // The event is consumed here as an integration hook for future application notes.
    }

    @RabbitListener(queues = AccountRabbitConfig.SUBJECT_REQUEST_REJECTED_QUEUE)
    public void onRejected(SubjectRequestRejectedEvent event) {
        // Same integration hook as approval; no synchronous workflow depends on this event.
    }
}
