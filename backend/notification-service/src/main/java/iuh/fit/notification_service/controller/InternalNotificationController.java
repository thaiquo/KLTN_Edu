package iuh.fit.notification_service.controller;

import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.service.NotificationCommand;
import iuh.fit.notification_service.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.beans.factory.annotation.Value;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications/internal")
public class InternalNotificationController {

    private final NotificationService notificationService;
    private final SecretKey serviceKey;

    public InternalNotificationController(NotificationService notificationService,
                                          @Value("${jwt.secret}") String secret) {
        this.notificationService = notificationService;
        this.serviceKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public record InternalSendRequest(
            String recipientEmail,
            Long recipientId,
            String title,
            String content,
            String type,
            String referenceType,
            String referenceId,
            String targetRole,
            String eventId
    ) {}

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> sendInternal(
            @RequestHeader(value = "X-Service-Token", required = false) String serviceToken,
            @RequestBody InternalSendRequest request) {
        try {
            var claims = Jwts.parser().verifyWith(serviceKey).build().parseSignedClaims(serviceToken).getPayload();
            if (!"contract-service".equals(claims.getSubject())
                    || !"notification-send".equals(claims.get("serviceScope", String.class))
                    || claims.getExpiration() == null) throw new IllegalArgumentException();
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Service authentication required");
        }
        if (request.recipientId() == null || request.recipientId() <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "recipientId is required"));
        }

        String eventId = request.eventId() != null && !request.eventId().isBlank()
                ? request.eventId()
                : "internal:" + UUID.randomUUID();

        NotificationCommand command = new NotificationCommand(
                eventId,
                request.recipientId(),
                request.type() != null ? request.type() : "GENERAL",
                request.title() != null ? request.title() : "Thông báo hệ thống",
                request.content() != null ? request.content() : "",
                request.targetRole(),
                request.referenceType(),
                request.referenceId()
        );

        Notification notification = notificationService.createIfAbsent(command);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "notificationId", notification.getId(),
                "eventId", eventId
        ));
    }
}
