package iuh.fit.ai_service.chatbot.controller;

import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatRequest;
import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatResponse;
import iuh.fit.ai_service.chatbot.security.AiUserContextResolver;
import iuh.fit.ai_service.chatbot.service.ChatbotOrchestrator;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/chat")
public class ChatbotController {
    private final ChatbotOrchestrator orchestrator;
    private final AiUserContextResolver userContextResolver;

    public ChatbotController(ChatbotOrchestrator orchestrator, AiUserContextResolver userContextResolver) {
        this.orchestrator = orchestrator;
        this.userContextResolver = userContextResolver;
    }

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        return ResponseEntity.ok(orchestrator.respond(request, userContextResolver.currentUser()));
    }
}
