package iuh.fit.authservice.infrastructure.external;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.authservice.infrastructure.config.OutboxRelayProperties;
import iuh.fit.authservice.modules.auth.entity.OutboxEvent;
import iuh.fit.authservice.modules.auth.repository.OutboxEventRepository;
import iuh.fit.authservice.shared.enums.OutboxStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
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
            } catch (Exception exception) {
                logger.warn("Failed to publish outbox event {}. It will remain pending for retry.", event.getId(), exception);
            }
        }
    }
}