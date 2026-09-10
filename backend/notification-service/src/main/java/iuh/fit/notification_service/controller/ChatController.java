package iuh.fit.notification_service.controller;

import iuh.fit.notification_service.config.security.NotificationPrincipal;
import iuh.fit.notification_service.dto.ChatMessageDto;
import iuh.fit.notification_service.dto.ConversationDto;
import iuh.fit.notification_service.dto.SendMessageRequest;
import iuh.fit.notification_service.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
    private final ChatService chatService;
    public ChatController(ChatService chatService) { this.chatService = chatService; }

    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationDto>> getConversations(
            @AuthenticationPrincipal NotificationPrincipal principal) {
        return ResponseEntity.ok(chatService.getUserConversations(principal.email()));
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<ChatMessageDto>> getConversationMessages(
            @PathVariable UUID id, @AuthenticationPrincipal NotificationPrincipal principal) {
        return ResponseEntity.ok(chatService.getConversationMessages(id, principal.email()));
    }

    @PostMapping("/messages")
    public ResponseEntity<ChatMessageDto> sendMessage(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(chatService.sendMessage(principal.userId(), principal.email(), request));
    }
}
