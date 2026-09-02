package iuh.fit.learning_service.messaging;

import iuh.fit.learning_service.messaging.event.EnrollmentNotificationEvent;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.eq;

class LearningEventPublisherTest {

    @Test
    void publishEnrollmentRequestedUsesRoutingKeyAndStablePayloadShape() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate);
        ArgumentCaptor<EnrollmentNotificationEvent> captor = ArgumentCaptor.forClass(EnrollmentNotificationEvent.class);

        publisher.publishEnrollmentRequested(11L, 22L, 33L, 44L, "Math 10", "An");

        verify(rabbitTemplate).convertAndSend(
                eq(LearningRabbitConfig.EXCHANGE),
                eq(LearningRabbitConfig.ENROLLMENT_REQUESTED_ROUTING_KEY),
                captor.capture()
        );
        EnrollmentNotificationEvent event = captor.getValue();
        assertThat(event.eventId()).isNotBlank();
        assertThat(event.eventType()).isEqualTo("ENROLLMENT_REQUESTED");
        assertThat(event.producer()).isEqualTo("learning-service");
        assertThat(event.enrollmentRequestId()).isEqualTo(11L);
        assertThat(event.classId()).isEqualTo(22L);
        assertThat(event.recipientUserId()).isEqualTo(33L);
        assertThat(event.actorUserId()).isEqualTo(44L);
    }

    @Test
    void publishEnrollmentSkipsSelfNotification() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate);

        publisher.publishEnrollmentAccepted(11L, 22L, 33L, 33L, "Math 10", "An");

        verifyNoInteractions(rabbitTemplate);
    }
}
