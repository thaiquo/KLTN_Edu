package iuh.fit.notification_service.controller;

import iuh.fit.notification_service.dto.NotificationDto;
import iuh.fit.notification_service.dto.SendNotificationRequest;
import iuh.fit.notification_service.service.NotificationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /**
     * Get paginated notifications for current user.
     * Header X-User-Email is passed from API Gateway JWT claims.
     */
    @GetMapping
    public ResponseEntity<Page<NotificationDto>> getUserNotifications(
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestParam(value = "email", required = false) String emailParam,
            @PageableDefault(size = 20) Pageable pageable) {

        String email = !userEmail.isBlank() ? userEmail : emailParam;
        if (email == null || email.isBlank()) {
            return ResponseEntity.ok(Page.empty(pageable));
        }
        return ResponseEntity.ok(notificationService.getUserNotifications(email, pageable));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestParam(value = "email", required = false) String emailParam) {

        String email = !userEmail.isBlank() ? userEmail : emailParam;
        if (email == null || email.isBlank()) {
            return ResponseEntity.ok(Map.of("unreadCount", 0L));
        }
        long count = notificationService.getUnreadCount(email);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationDto> markAsRead(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestParam(value = "email", required = false) String emailParam) {

        String email = !userEmail.isBlank() ? userEmail : emailParam;
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(notificationService.markAsRead(id, email));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, Integer>> markAllAsRead(
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestParam(value = "email", required = false) String emailParam) {

        String email = !userEmail.isBlank() ? userEmail : emailParam;
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        int count = notificationService.markAllAsRead(email);
        return ResponseEntity.ok(Map.of("updatedCount", count));
    }

    /**
     * Internal endpoint for other microservices (contract-service, learning-service, account-service)
     * to dispatch notifications.
     */
    @PostMapping("/internal/send")
    public ResponseEntity<NotificationDto> sendNotification(@Valid @RequestBody SendNotificationRequest request) {
        NotificationDto created = notificationService.createAndSendNotification(request);
        return ResponseEntity.ok(created);
    }
}
