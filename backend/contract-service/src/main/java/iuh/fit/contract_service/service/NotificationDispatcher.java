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

@Component
public class NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final HttpClient httpClient;
    private final String notificationServiceUrl;

    public NotificationDispatcher(
            @Value("${NOTIFICATION_SERVICE_URL:http://localhost:8085}") String notificationServiceUrl) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.notificationServiceUrl = notificationServiceUrl;
    }

    public void sendAsync(String recipientEmail, Long recipientId, String title, String content, String type, String referenceType, String referenceId) {
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
