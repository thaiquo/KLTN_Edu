package iuh.fit.notification_service.controller;

import iuh.fit.notification_service.config.security.NotificationPrincipal;
import iuh.fit.notification_service.dto.ChatMessagePageDto;
import iuh.fit.notification_service.dto.ChatMessageDto;
import iuh.fit.notification_service.dto.ConversationDto;
import iuh.fit.notification_service.dto.MarkReadResponse;
import iuh.fit.notification_service.dto.SendMessageRequest;
import iuh.fit.notification_service.dto.StartDirectConversationRequest;
import iuh.fit.notification_service.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartHttpServletRequest;
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
        return ResponseEntity.ok(chatService.getUserConversations(principal));
    }

    @PostMapping("/conversations/direct")
    public ResponseEntity<ConversationDto> startDirectConversation(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @Valid @RequestBody StartDirectConversationRequest request) {
        return ResponseEntity.ok(chatService.startDirectConversation(principal, request));
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<ChatMessagePageDto> getConversationMessages(
            @PathVariable UUID id,
            @AuthenticationPrincipal NotificationPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(chatService.getConversationMessages(id, principal, page, size));
    }

    @PostMapping("/conversations/{id}/read")
    public ResponseEntity<MarkReadResponse> markConversationRead(
            @PathVariable UUID id,
            @AuthenticationPrincipal NotificationPrincipal principal) {
        return ResponseEntity.ok(chatService.markConversationRead(id, principal));
    }

    @PostMapping("/messages")
    public ResponseEntity<ChatMessageDto> sendMessage(
            @AuthenticationPrincipal NotificationPrincipal principal,
            @Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(chatService.sendMessage(principal, request));
    }

    @PostMapping("/conversations/{id}/attachments")
    public ResponseEntity<ChatMessageDto> sendAttachment(
            @PathVariable UUID id,
            @AuthenticationPrincipal NotificationPrincipal principal,
            MultipartHttpServletRequest request,
            @RequestParam(name = "caption", required = false) String caption) {
        List<org.springframework.web.multipart.MultipartFile> files = new java.util.ArrayList<>();
        files.addAll(request.getFiles("files"));
        return ResponseEntity.ok(chatService.sendAttachment(principal, id, files, caption));
    }
}
