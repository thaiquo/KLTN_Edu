package iuh.fit.account_service.infrastructure.external;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.account_service.infrastructure.config.OutboxRelayProperties;
import iuh.fit.account_service.modules.auth.entity.OutboxEvent;
import iuh.fit.account_service.modules.auth.repository.OutboxEventRepository;
import iuh.fit.account_service.shared.enums.OutboxStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(prefix = "auth.outbox.relay", name = "enabled", havingValue = "true")
public class OutboxRelayService {

    private static final Logger logger = LoggerFactory.getLogger(OutboxRelayService.class);

    private final OutboxEventRepository outboxEventRepository;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final OutboxRelayProperties properties;

    public OutboxRelayService(OutboxEventRepository outboxEventRepository,
                              RabbitTemplate rabbitTemplate,
                              ObjectMapper objectMapper,
                              OutboxRelayProperties properties) {
        this.outboxEventRepository = outboxEventRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${auth.outbox.relay.fixed-delay-ms:5000}")
    @Transactional
    public void relayPendingEvents() {
        List<OutboxEvent> pendingEvents = outboxEventRepository.findAllByStatusOrderByCreatedAtAsc(OutboxStatus.PENDING);
        for (OutboxEvent event : pendingEvents) {
            try {
                Map<String, Object> message = objectMapper.readValue(event.getPayload(), Map.class);
                rabbitTemplate.convertAndSend(properties.getExchange(), "", message);
                event.setStatus(OutboxStatus.PUBLISHED);
                event.setPublishedAt(Instant.now());
                outboxEventRepository.save(event);
            } catch (JsonProcessingException exception) {
                logger.error("Failed to deserialize outbox payload for event {}", event.getId(), exception);
                event.setStatus(OutboxStatus.FAILED);
                outboxEventRepository.save(event);
            } catch (AmqpConnectException exception) {
                logger.warn("RabbitMQ is unavailable. Pending outbox events will be retried later.");
                break;
            } catch (Exception exception) {
                logger.warn("Failed to publish outbox event {}. It will remain pending for retry.", event.getId(), exception);
            }
        }
    }
}
