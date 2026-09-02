package iuh.fit.notification_service.controller;

import iuh.fit.notification_service.config.security.NotificationPrincipal;
import iuh.fit.notification_service.dto.NotificationDtos.MarkAllReadResponse;
import iuh.fit.notification_service.dto.NotificationDtos.NotificationPageResponse;
import iuh.fit.notification_service.dto.NotificationDtos.NotificationResponse;
import iuh.fit.notification_service.dto.NotificationDtos.UnreadCountResponse;
import iuh.fit.notification_service.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public NotificationPageResponse list(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(required = false) String targetRole
    ) {
        return notificationService.list(principal.userId(), page, size, unreadOnly, targetRole);
    }

    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @RequestParam(required = false) String targetRole
    ) {
        return notificationService.unreadCount(principal.userId(), targetRole);
    }

    @PatchMapping("/{id}/read")
    public NotificationResponse markRead(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @PathVariable Long id
    ) {
        return notificationService.markRead(principal.userId(), id);
    }

    @PatchMapping("/read-all")
    public MarkAllReadResponse markAllRead(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @RequestParam(required = false) String targetRole
    ) {
        return notificationService.markAllRead(principal.userId(), targetRole);
    }
}
