package iuh.fit.notification_service.controller;

import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.service.NotificationCommand;
import iuh.fit.notification_service.service.NotificationService;
import org.springframework.http.ResponseEntity;
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

    public InternalNotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
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
    public ResponseEntity<Map<String, Object>> sendInternal(@RequestBody InternalSendRequest request) {
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
