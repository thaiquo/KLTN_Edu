package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

@Service
public class ChatRagRetriever {
    private final EmbeddingService embeddingService;
    private final ChatKnowledgeVectorStore vectorStore;
    private final ChatKnowledgeProperties properties;

    public ChatRagRetriever(
            EmbeddingService embeddingService,
            ChatKnowledgeVectorStore vectorStore,
            ChatKnowledgeProperties properties
    ) {
        this.embeddingService = embeddingService;
        this.vectorStore = vectorStore;
        this.properties = properties;
    }

    public List<KnowledgeSearchHit> retrieve(String query, AiUserContext userContext, Integer topK) {
        if (!StringUtils.hasText(query)) {
            return List.of();
        }
        EmbeddingVector vector = embeddingService.embed(query.trim());
        return vectorStore.search(
                vector,
                roleVisibility(userContext),
                topK == null ? properties.topK() : Math.max(1, topK),
                properties.minScore()
        );
    }

    private List<String> roleVisibility(AiUserContext userContext) {
        LinkedHashSet<String> roles = new LinkedHashSet<>();
        roles.add("PUBLIC");
        roles.add("GUEST");
        if (userContext != null && userContext.authenticated()) {
            if (StringUtils.hasText(userContext.activeRole())) {
                roles.add(userContext.activeRole().trim().toUpperCase(Locale.ROOT));
            }
            for (String role : userContext.roles() == null ? List.<String>of() : userContext.roles()) {
                if (StringUtils.hasText(role)) {
                    roles.add(role.trim().toUpperCase(Locale.ROOT));
                }
            }
        }
        return new ArrayList<>(roles);
    }
}
