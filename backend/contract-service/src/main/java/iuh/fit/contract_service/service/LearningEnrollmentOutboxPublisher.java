package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.ContractRabbitConfig;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Delivers the durable enrollment state transition after the Contract database
 * transaction commits. Consumers are idempotent, so a crash after broker
 * delivery but before marking published is safe: RabbitMQ may redeliver.
 */
@Component
public class LearningEnrollmentOutboxPublisher {
    private static final Logger log = LoggerFactory.getLogger(LearningEnrollmentOutboxPublisher.class);
    private static final List<String> LEARNING_EVENT_TYPES = List.of("contract.activated.v1", "contract.expired.v1");

    private final OutboxEventRepository outbox;
    private final RabbitTemplate rabbitTemplate;

    public LearningEnrollmentOutboxPublisher(OutboxEventRepository outbox, RabbitTemplate rabbitTemplate) {
        this.outbox = outbox;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Scheduled(initialDelayString = "${contract.learning-outbox.initial-delay-ms:10000}",
            fixedDelayString = "${contract.learning-outbox.delay-ms:5000}")
    @Transactional
    public void publishPendingEnrollmentEvents() {
        for (OutboxEvent event : outbox.findTop50ByEventTypeInAndPublishedAtIsNullOrderByOccurredAtAsc(LEARNING_EVENT_TYPES)) {
            try {
                rabbitTemplate.convertAndSend(ContractRabbitConfig.EVENTS_EXCHANGE, event.getEventType(), event.getPayload());
                event.markPublished(OffsetDateTime.now(ZoneOffset.UTC));
            } catch (RuntimeException ex) {
                event.recordPublishFailure(ex.getMessage());
                log.warn("Could not publish learning outbox event {} (attempt {}): {}",
                        event.getEventId(), event.getAttemptCount(), ex.getMessage());
            }
        }
    }
}
