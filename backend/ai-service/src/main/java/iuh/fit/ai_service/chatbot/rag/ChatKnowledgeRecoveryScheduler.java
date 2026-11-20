package iuh.fit.ai_service.chatbot.rag;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
        name = "chatbot.knowledge.auto-sync-enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class ChatKnowledgeRecoveryScheduler {
    private final ChatKnowledgeIndexService indexService;

    public ChatKnowledgeRecoveryScheduler(ChatKnowledgeIndexService indexService) {
        this.indexService = indexService;
    }

    @Scheduled(
            initialDelayString = "${chatbot.knowledge.startup-delay-ms:1000}",
            fixedDelayString = "${chatbot.knowledge.recovery-interval-ms:30000}"
    )
    public void synchronize() {
        indexService.recoverAndSynchronize();
    }
}
