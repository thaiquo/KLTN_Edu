package iuh.fit.ai_service.chatbot.controller;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeIndexService;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexResult;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.IndexStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/admin/chatbot-knowledge")
public class ChatKnowledgeAdminController {
    private final ChatKnowledgeIndexService indexService;

    public ChatKnowledgeAdminController(ChatKnowledgeIndexService indexService) {
        this.indexService = indexService;
    }

    @PostMapping("/reindex")
    public ResponseEntity<IndexResult> reindex() {
        return ResponseEntity.ok(indexService.reindex());
    }

    @GetMapping("/status")
    public ResponseEntity<IndexStatus> status() {
        return ResponseEntity.ok(indexService.status());
    }

    @ExceptionHandler(ChatKnowledgeIndexService.KnowledgeSyncInProgressException.class)
    public ResponseEntity<java.util.Map<String, Object>> syncInProgress(
            ChatKnowledgeIndexService.KnowledgeSyncInProgressException exception
    ) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(java.util.Map.of(
                "status", 409,
                "message", exception.getMessage()
        ));
    }
}
