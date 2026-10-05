package iuh.fit.notification_service.controller;

import iuh.fit.notification_service.config.security.NotificationPrincipal;
import iuh.fit.notification_service.dto.NotificationDtos.MarkAllReadResponse;
import iuh.fit.notification_service.dto.NotificationDtos.ChatViewContextRequest;
import iuh.fit.notification_service.dto.NotificationDtos.ChatViewContextResponse;
import iuh.fit.notification_service.dto.NotificationDtos.NotificationPageResponse;
import iuh.fit.notification_service.dto.NotificationDtos.NotificationResponse;
import iuh.fit.notification_service.dto.NotificationDtos.UnreadCountResponse;
import iuh.fit.notification_service.service.ChatViewPresenceService;
import iuh.fit.notification_service.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final ChatViewPresenceService chatViewPresenceService;

    public NotificationController(
            NotificationService notificationService,
            ChatViewPresenceService chatViewPresenceService) {
        this.notificationService = notificationService;
        this.chatViewPresenceService = chatViewPresenceService;
    }

    @GetMapping
    public NotificationPageResponse list(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(required = false) String targetRole) {
        return notificationService.list(
                principal.userId(),
                page,
                size,
                unreadOnly,
                targetRole);
    }

    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @RequestParam(required = false) String targetRole) {
        return notificationService.unreadCount(
                principal.userId(),
                targetRole);
    }

    @PatchMapping("/{id}/read")
    public NotificationResponse markRead(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @PathVariable Long id) {
        return notificationService.markRead(
                principal.userId(),
                id);
    }

    @PatchMapping("/read-all")
    public MarkAllReadResponse markAllRead(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @RequestParam(required = false) String targetRole) {
        return notificationService.markAllRead(
                principal.userId(),
                targetRole);
    }

    @PutMapping("/chat-view-context")
    public ChatViewContextResponse updateChatViewContext(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @RequestBody ChatViewContextRequest request) {
        boolean active = request != null && request.active();
        chatViewPresenceService.update(
                principal.userId(),
                request != null ? request.clientId() : null,
                active);
        return new ChatViewContextResponse(
                chatViewPresenceService.isChatViewActive(principal.userId()));
    }
}
