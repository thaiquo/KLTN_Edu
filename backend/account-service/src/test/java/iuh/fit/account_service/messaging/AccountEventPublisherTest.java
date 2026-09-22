package iuh.fit.account_service.messaging;

import iuh.fit.account_service.messaging.event.TutorApplicationSubmittedEvent;
import iuh.fit.account_service.service.StaffNotificationRecipientResolver;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AccountEventPublisherTest {

    @Test
    void publishTutorApplicationSubmittedSendsOneEventPerActiveStaffRecipient() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        StaffNotificationRecipientResolver resolver = mock(StaffNotificationRecipientResolver.class);
        when(resolver.activeStaffUserIds()).thenReturn(List.of(20L, 900L, 901L));
        AccountEventPublisher publisher = new AccountEventPublisher(rabbitTemplate, resolver);
        ArgumentCaptor<TutorApplicationSubmittedEvent> captor =
                ArgumentCaptor.forClass(TutorApplicationSubmittedEvent.class);

        publisher.publishTutorApplicationSubmitted(new TutorApplicationSubmittedEvent(
                "submitted-1",
                10L,
                20L,
                LocalDateTime.now()));

        verify(rabbitTemplate, org.mockito.Mockito.times(2)).convertAndSend(
                eq(AccountRabbitConfig.EXCHANGE),
                eq(AccountRabbitConfig.TUTOR_APPLICATION_SUBMITTED_ROUTING_KEY),
                captor.capture());
        assertThat(captor.getAllValues()).extracting(TutorApplicationSubmittedEvent::eventId)
                .containsExactly("submitted-1", "submitted-1");
        assertThat(captor.getAllValues()).extracting(TutorApplicationSubmittedEvent::recipientUserId)
                .containsExactly(900L, 901L);
        assertThat(captor.getAllValues()).extracting(TutorApplicationSubmittedEvent::userId)
                .containsOnly(20L);
    }

    @Test
    void publishTutorApplicationSubmittedSkipsWhenNoActiveStaffRecipientExists() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        StaffNotificationRecipientResolver resolver = mock(StaffNotificationRecipientResolver.class);
        when(resolver.activeStaffUserIds()).thenReturn(List.of());
        AccountEventPublisher publisher = new AccountEventPublisher(rabbitTemplate, resolver);

        publisher.publishTutorApplicationSubmitted(new TutorApplicationSubmittedEvent(
                "submitted-1",
                10L,
                20L,
                LocalDateTime.now()));

        verifyNoInteractions(rabbitTemplate);
    }
}
