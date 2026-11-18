package iuh.fit.api_gateway.reporting;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.List;

/** Publishes durable, idempotent Bell alerts when an evaluated work item is due soon or overdue. */
@Service
public class OperationalSlaNotificationPublisher {
    private static final Logger log = LoggerFactory.getLogger(OperationalSlaNotificationPublisher.class);

    private final WebClient account;
    private final WebClient notification;
    private final SecretKey key;
    private final boolean enabled;

    public OperationalSlaNotificationPublisher(
            @Value("${operations.sla.notifications.account-url}") String accountUrl,
            @Value("${operations.sla.notifications.notification-url}") String notificationUrl,
            @Value("${jwt.secret}") String secret,
            @Value("${operations.sla.notifications.enabled:true}") boolean enabled) {
        WebClient.Builder builder = WebClient.builder();
        this.account = builder.clone().baseUrl(accountUrl).build();
        this.notification = builder.clone().baseUrl(notificationUrl).build();
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.enabled = enabled;
    }

    Mono<Void> publish(List<OperationalWorkItemService.WorkItemV1> items) {
        if (!enabled || items == null || items.isEmpty()) return Mono.empty();
        return Flux.fromIterable(items)
                .filter(this::requiresAlert)
                .flatMap(this::publishOne, 4)
                .onErrorContinue((error, ignored) -> log.warn("Operational SLA Bell publication skipped: {}",
                        error.getClass().getSimpleName()))
                .then();
    }

    private boolean requiresAlert(OperationalWorkItemService.WorkItemV1 item) {
        return item.slaState() == OperationalSlaPolicy.SlaState.DUE_SOON
                || item.slaState() == OperationalSlaPolicy.SlaState.OVERDUE;
    }

    private Mono<Void> publishOne(OperationalWorkItemService.WorkItemV1 item) {
        return account.get()
                .uri(builder -> {
                    builder.path("/api/internal/notification-reviewers");
                    if ("SUPPORT_TICKET".equals(item.source())) {
                        builder.queryParam("supportTicketId", item.resourceId());
                    } else {
                        builder.queryParam("reviewerEmail", StringUtils.hasText(item.assignee()) ? item.assignee() : "");
                    }
                    return builder.build();
                })
                .header("X-Service-Token", token("notification-recipients"))
                .retrieve()
                .bodyToFlux(Recipient.class)
                .flatMap(recipient -> send(item, recipient), 4)
                .then()
                .onErrorResume(error -> {
                    log.warn("Could not publish SLA Bell alert source={} resourceId={} state={} cause={}",
                            item.source(), item.resourceId(), item.slaState(), error.getClass().getSimpleName());
                    return Mono.empty();
                });
    }

    private Mono<Void> send(OperationalWorkItemService.WorkItemV1 item, Recipient recipient) {
        InternalSendRequest body = new InternalSendRequest(
                recipient.recipientId(), title(item), message(item), "OPERATIONAL_SLA_ALERT",
                item.source(), item.resourceId(), recipient.targetRole(), eventId(item));
        return notification.post()
                .uri("/api/notifications/internal/send")
                .header("X-Service-Token", token("notification-send"))
                .bodyValue(body)
                .retrieve()
                .toBodilessEntity()
                .then();
    }

    String eventId(OperationalWorkItemService.WorkItemV1 item) {
        String canonical = String.join("|", item.source(), item.resourceId(), item.workflowRevision(),
                item.slaState().name());
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8));
            return "operational-sla:" + item.slaState().name().toLowerCase() + ":" + HexFormat.of().formatHex(digest);
        } catch (Exception error) {
            throw new IllegalStateException("SHA-256 is unavailable", error);
        }
    }

    private String title(OperationalWorkItemService.WorkItemV1 item) {
        return item.slaState() == OperationalSlaPolicy.SlaState.OVERDUE
                ? "Công việc vận hành đã quá hạn"
                : "Công việc vận hành sắp đến hạn";
    }

    private String message(OperationalWorkItemService.WorkItemV1 item) {
        String label = StringUtils.hasText(item.title()) ? item.title() : item.source() + " #" + item.resourceId();
        return item.slaState() == OperationalSlaPolicy.SlaState.OVERDUE
                ? label + " đã quá hạn xử lý. Vui lòng kiểm tra Action Center."
                : label + " sắp đến hạn xử lý. Vui lòng kiểm tra Action Center.";
    }

    private String token(String scope) {
        return Jwts.builder()
                .subject("api-gateway")
                .claim("serviceScope", scope)
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(key)
                .compact();
    }

    record Recipient(Long recipientId, String targetRole) { }

    record InternalSendRequest(Long recipientId, String title, String content, String type,
                               String referenceType, String referenceId, String targetRole, String eventId) { }
}
