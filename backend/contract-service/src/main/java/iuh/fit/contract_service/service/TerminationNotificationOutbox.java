package iuh.fit.contract_service.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.ObjectMapper;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import javax.crypto.SecretKey;

/** Intent is committed with the business change; retries reuse the same notification event id. */
@Service
public class TerminationNotificationOutbox {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TransactionTemplate transaction;
    private final String accountUrl;
    private final String notificationUrl;
    private final SecretKey key;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    public record Recipient(Long recipientId, String targetRole) {}
    public record Intent(Long recipientId, String reviewerEmail, String title, String content,
                         String type, String referenceType, String referenceId) {}

    public TerminationNotificationOutbox(JdbcTemplate jdbc, ObjectMapper mapper, PlatformTransactionManager manager,
            @Value("${ACCOUNT_SERVICE_URL:http://localhost:8081}") String accountUrl,
            @Value("${NOTIFICATION_SERVICE_URL:http://localhost:8084}") String notificationUrl,
            @Value("${jwt.secret}") String secret) {
        this.jdbc = jdbc; this.mapper = mapper; this.transaction = new TransactionTemplate(manager);
        this.accountUrl = accountUrl; this.notificationUrl = notificationUrl;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Transactional
    public void enqueue(String eventId, Intent intent) {
        jdbc.update("INSERT INTO termination_notification_outbox(event_id,payload) VALUES (?,?) ON CONFLICT DO NOTHING",
                eventId, mapper.writeValueAsString(intent));
    }

    @Scheduled(initialDelayString = "${termination.notifications.initial-delay-ms:20000}",
            fixedDelayString = "${termination.notifications.delay-ms:5000}")
    public void deliver() {
        enqueueExpiredDeadlines();
        var ids = jdbc.queryForList("SELECT event_id FROM termination_notification_outbox WHERE delivered_at IS NULL AND next_attempt_at <= CURRENT_TIMESTAMP ORDER BY created_at LIMIT 25", String.class);
        for (var id : ids) transaction.executeWithoutResult(status -> attempt(id));
    }

    private void enqueueExpiredDeadlines() {
        transaction.executeWithoutResult(status -> {
            var rows = jdbc.queryForList("SELECT c.id,a.id AS agreement_id,a.classroom_reviewer_email FROM termination_case c JOIN contract_agreement a ON a.id=c.anchor_agreement_id WHERE c.origin='AUTO_TUTOR_ABSENCE' AND c.status='REQUESTED' AND c.tutor_responded_at IS NULL AND c.response_deadline <= CURRENT_TIMESTAMP AND NOT EXISTS (SELECT 1 FROM termination_notification_outbox o WHERE o.event_id=CONCAT('termination:deadline:',CAST(c.id AS VARCHAR))) LIMIT 50");
            for (var row : rows) enqueue("termination:deadline:" + row.get("id"), new Intent(null,
                    (String) row.get("classroom_reviewer_email"), "Hồ sơ hủy lớp đã hết hạn giải trình",
                    "Gia sư chưa phản hồi khi hết hạn. Staff có thể kiến nghị và Admin có thể quyết định; lớp tiếp tục tạm dừng.",
                    "TERMINATION_DEADLINE_EXPIRED", "AGREEMENT", row.get("agreement_id").toString()));
        });
    }

    private void attempt(String id) {
        var rows = jdbc.queryForList("SELECT payload,recipients_json,attempts FROM termination_notification_outbox WHERE event_id=? AND delivered_at IS NULL AND next_attempt_at <= CURRENT_TIMESTAMP FOR UPDATE SKIP LOCKED", id);
        if (rows.isEmpty()) return;
        var row = rows.getFirst();
        try {
            var intent = mapper.readValue((String) row.get("payload"), Intent.class);
            String recipientsJson = (String) row.get("recipients_json");
            if (recipientsJson == null) {
                Recipient[] recipients = intent.recipientId() != null && intent.recipientId() > 0
                        ? new Recipient[]{new Recipient(intent.recipientId(), null)} : resolve(intent.reviewerEmail());
                if (recipients.length == 0) throw new IllegalStateException("No eligible reviewer recipients");
                jdbc.update("UPDATE termination_notification_outbox SET recipients_json=? WHERE event_id=?",
                        mapper.writeValueAsString(recipients), id);
                // Commit the recipient snapshot before delivery, so partial retries target the same users.
                return;
            }
            for (var recipient : mapper.readValue(recipientsJson, Recipient[].class)) {
                Map<String,Object> body = new LinkedHashMap<>();
                body.put("eventId", id); body.put("recipientId", recipient.recipientId());
                body.put("targetRole", recipient.targetRole()); body.put("title", intent.title());
                body.put("content", intent.content()); body.put("type", intent.type());
                body.put("referenceType", intent.referenceType()); body.put("referenceId", intent.referenceId());
                var request = HttpRequest.newBuilder(URI.create(notificationUrl + "/api/notifications/internal/send"))
                        .timeout(Duration.ofSeconds(5)).header("Content-Type", "application/json")
                        .header("X-Service-Token", Jwts.builder().subject("contract-service")
                                .claim("serviceScope", "notification-send")
                                .expiration(Date.from(Instant.now().plusSeconds(60))).signWith(key).compact())
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
                var response = http.send(request, HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() / 100 != 2) throw new IllegalStateException("Notification HTTP " + response.statusCode());
            }
            jdbc.update("UPDATE termination_notification_outbox SET delivered_at=CURRENT_TIMESTAMP WHERE event_id=?", id);
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            int attempts = ((Number) row.get("attempts")).intValue() + 1;
            jdbc.update("UPDATE termination_notification_outbox SET attempts=?,next_attempt_at=? WHERE event_id=?",
                    attempts, OffsetDateTime.now().plusSeconds(Math.min(300, 5L * attempts)), id);
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Termination notification {} pending retry: {}", id, e.getClass().getSimpleName());
        }
    }

    private Recipient[] resolve(String reviewerEmail) throws Exception {
        String token = Jwts.builder().subject("contract-service").claim("serviceScope", "notification-recipients")
                .expiration(Date.from(Instant.now().plusSeconds(60))).signWith(key).compact();
        var request = HttpRequest.newBuilder(URI.create(accountUrl + "/api/internal/notification-reviewers?reviewerEmail="
                + URLEncoder.encode(Objects.requireNonNullElse(reviewerEmail, ""), StandardCharsets.UTF_8)))
                .timeout(Duration.ofSeconds(5)).header("X-Service-Token", token).GET().build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) throw new IllegalStateException("Account HTTP " + response.statusCode());
        return mapper.readValue(response.body(), Recipient[].class);
    }
}
