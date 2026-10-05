package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LearningEnrollmentOutboxPublisherTest {

    @Test
    void marksEventPublishedOnlyAfterBrokerAcceptsIt() {
        OutboxEventRepository outbox = mock(OutboxEventRepository.class);
        RabbitTemplate rabbit = mock(RabbitTemplate.class);
        OutboxEvent event = OutboxEvent.create("contract.activated.v1", "ContractAgreement", "agreement-1",
                null, "{\"agreementId\":\"agreement-1\"}", OffsetDateTime.now(ZoneOffset.UTC));
        when(outbox.findTop50ByEventTypeInAndPublishedAtIsNullOrderByOccurredAtAsc(any()))
                .thenReturn(List.of(event));

        new LearningEnrollmentOutboxPublisher(outbox, rabbit).publishPendingEnrollmentEvents();

        verify(rabbit).convertAndSend(eq("kltn.edu.events"), eq("contract.activated.v1"), eq(event.getPayload()));
        assertThat(event.getPublishedAt()).isNotNull();
        assertThat(event.getAttemptCount()).isZero();
    }

    @Test
    void retainsEventForRetryWhenBrokerFails() {
        OutboxEventRepository outbox = mock(OutboxEventRepository.class);
        RabbitTemplate rabbit = mock(RabbitTemplate.class);
        OutboxEvent event = OutboxEvent.create("contract.expired.v1", "ContractAgreement", "agreement-1",
                null, "{\"agreementId\":\"agreement-1\"}", OffsetDateTime.now(ZoneOffset.UTC));
        when(outbox.findTop50ByEventTypeInAndPublishedAtIsNullOrderByOccurredAtAsc(any()))
                .thenReturn(List.of(event));
        doThrow(new IllegalStateException("broker unavailable"))
                .when(rabbit).convertAndSend(any(String.class), any(String.class), any(Object.class));

        new LearningEnrollmentOutboxPublisher(outbox, rabbit).publishPendingEnrollmentEvents();

        assertThat(event.getPublishedAt()).isNull();
        assertThat(event.getAttemptCount()).isEqualTo(1);
        assertThat(event.getLastError()).contains("broker unavailable");
    }
}
