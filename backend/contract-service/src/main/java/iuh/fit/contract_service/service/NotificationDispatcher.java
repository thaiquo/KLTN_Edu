package iuh.fit.contract_service.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final HttpClient httpClient;
    private final String notificationServiceUrl;
    private final TerminationNotificationOutbox terminationOutbox;
    private final SecretKey serviceKey;

    public NotificationDispatcher(
            @Value("${NOTIFICATION_SERVICE_URL:http://localhost:8084}") String notificationServiceUrl,
            TerminationNotificationOutbox terminationOutbox,
            @Value("${jwt.secret}") String secret) {
        this.terminationOutbox = terminationOutbox;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.notificationServiceUrl = notificationServiceUrl;
        this.serviceKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public void sendAsync(String recipientEmail, Long recipientId, String title, String content, String type, String referenceType, String referenceId) {
        if (type != null && type.startsWith("TERMINATION_")) {
            terminationOutbox.enqueue("termination:" + java.util.UUID.randomUUID(),
                    new TerminationNotificationOutbox.Intent(recipientId, recipientEmail, title, content, type, referenceType, referenceId));
            return;
        }
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return;
        }

        try {
            String url = notificationServiceUrl + "/api/notifications/internal/send";
            String escapedEmail = escapeJson(recipientEmail);
            String escapedTitle = escapeJson(title);
            String escapedContent = escapeJson(content);
            String escapedType = escapeJson(type);
            String escapedRefType = referenceType != null ? escapeJson(referenceType) : "";
            String escapedRefId = referenceId != null ? escapeJson(referenceId) : "";

            String bodyJson = String.format(
                    "{\"recipientEmail\":\"%s\",\"recipientId\":%d,\"title\":\"%s\",\"content\":\"%s\",\"type\":\"%s\",\"referenceType\":\"%s\",\"referenceId\":\"%s\"}",
                    escapedEmail, recipientId != null ? recipientId : 0, escapedTitle, escapedContent, escapedType, escapedRefType, escapedRefId
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(4))
                    .header("Content-Type", "application/json")
                    .header("X-Service-Token", Jwts.builder().subject("contract-service")
                            .claim("serviceScope", "notification-send")
                            .expiration(Date.from(Instant.now().plusSeconds(60))).signWith(serviceKey).compact())
                    .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                    .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .thenAccept(res -> {
                        if (res.statusCode() >= 200 && res.statusCode() < 300) {
                            log.info("Dispatched notification to {} ({})", recipientEmail, type);
                        } else {
                            log.warn("Notification dispatch received status {} for {}", res.statusCode(), recipientEmail);
                        }
                    })
                    .exceptionally(ex -> {
                        log.warn("Could not dispatch notification to {}: {}", recipientEmail, ex.getMessage());
                        return null;
                    });
        } catch (Exception e) {
            log.warn("Error preparing notification for {}: {}", recipientEmail, e.getMessage());
        }
    }

    private String escapeJson(String raw) {
        if (raw == null) return "";
        return raw.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
