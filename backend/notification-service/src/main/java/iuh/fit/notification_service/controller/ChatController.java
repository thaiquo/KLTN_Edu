package iuh.fit.notification_service.controller;

import iuh.fit.notification_service.dto.ChatMessageDto;
import iuh.fit.notification_service.dto.ConversationDto;
import iuh.fit.notification_service.dto.SendMessageRequest;
import iuh.fit.notification_service.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationDto>> getConversations(
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestParam(value = "email", required = false) String emailParam) {

        String email = !userEmail.isBlank() ? userEmail : emailParam;
        if (email == null || email.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        return ResponseEntity.ok(chatService.getUserConversations(email));
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<ChatMessageDto>> getConversationMessages(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestParam(value = "email", required = false) String emailParam) {

        String email = !userEmail.isBlank() ? userEmail : emailParam;
        if (email == null || email.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        return ResponseEntity.ok(chatService.getConversationMessages(id, email));
    }

    @PostMapping("/messages")
    public ResponseEntity<ChatMessageDto> sendMessage(
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestParam(value = "senderId", required = false, defaultValue = "0") Long senderIdParam,
            @RequestParam(value = "senderEmail", required = false) String senderEmailParam,
            @Valid @RequestBody SendMessageRequest request) {

        Long senderId = userId != 0 ? userId : senderIdParam;
        String senderEmail = !userEmail.isBlank() ? userEmail : senderEmailParam;

        if (senderEmail == null || senderEmail.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(chatService.sendMessage(senderId, senderEmail, request));
    }
}
