package iuh.fit.ai_service.chatbot.controller;

import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatRequest;
import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatResponse;
import iuh.fit.ai_service.chatbot.security.AiUserContextResolver;
import iuh.fit.ai_service.chatbot.service.ChatbotOrchestrator;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeIndexService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/chat")
public class ChatbotController {
    private final ChatbotOrchestrator orchestrator;
    private final AiUserContextResolver userContextResolver;
    private final ChatKnowledgeIndexService knowledgeIndexService;

    public ChatbotController(
            ChatbotOrchestrator orchestrator,
            AiUserContextResolver userContextResolver,
            ChatKnowledgeIndexService knowledgeIndexService
    ) {
        this.orchestrator = orchestrator;
        this.userContextResolver = userContextResolver;
        this.knowledgeIndexService = knowledgeIndexService;
    }

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        return ResponseEntity.ok(orchestrator.respond(request, userContextResolver.currentUser()));
    }

    @GetMapping("/knowledge-status")
    public ResponseEntity<java.util.Map<String, Object>> knowledgeStatus() {
        var status = knowledgeIndexService.status();
        return ResponseEntity.ok(java.util.Map.of(
                "state", status.state(),
                "available", status.collectionExists() && status.pointCount() > 0,
                "syncInProgress", status.syncInProgress()
        ));
    }
}
