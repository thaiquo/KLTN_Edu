package iuh.fit.ai_service.chatbot.rag;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ChatKnowledgeProperties {
    private final String knowledgeDirectory;
    private final String collection;
    private final int vectorSize;
    private final int topK;
    private final double minScore;
    private final int documentVersion;
    private final int retryAttempts;
    private final long retryInitialBackoffMs;

    @Autowired
    public ChatKnowledgeProperties(
            @Value("${chatbot.knowledge.directory:docs/chatbot-knowledge}") String knowledgeDirectory,
            @Value("${chatbot.qdrant.collection:educonnect_chatbot_knowledge_v1}") String collection,
            @Value("${qdrant.vector-size:768}") int vectorSize,
            @Value("${chatbot.rag.top-k:4}") int topK,
            @Value("${chatbot.rag.min-score:0.35}") double minScore,
            @Value("${chatbot.knowledge.version:1}") int documentVersion,
            @Value("${chatbot.knowledge.retry-attempts:3}") int retryAttempts,
            @Value("${chatbot.knowledge.retry-initial-backoff-ms:1000}") long retryInitialBackoffMs
    ) {
        this.knowledgeDirectory = StringUtils.hasText(knowledgeDirectory)
                ? knowledgeDirectory.trim()
                : "docs/chatbot-knowledge";
        this.collection = StringUtils.hasText(collection)
                ? collection.trim()
                : "educonnect_chatbot_knowledge_v1";
        this.vectorSize = vectorSize;
        this.topK = Math.max(1, topK);
        this.minScore = Math.max(0.0, minScore);
        this.documentVersion = Math.max(1, documentVersion);
        this.retryAttempts = Math.max(1, Math.min(retryAttempts, 6));
        this.retryInitialBackoffMs = Math.max(100L, Math.min(retryInitialBackoffMs, 10_000L));
    }

    ChatKnowledgeProperties(
            String knowledgeDirectory,
            String collection,
            int vectorSize,
            int topK,
            double minScore,
            int documentVersion
    ) {
        this(knowledgeDirectory, collection, vectorSize, topK, minScore, documentVersion, 3, 1000L);
    }

    public String knowledgeDirectory() {
        return knowledgeDirectory;
    }

    public String collection() {
        return collection;
    }

    public int vectorSize() {
        return vectorSize;
    }

    public int topK() {
        return topK;
    }

    public double minScore() {
        return minScore;
    }

    public int documentVersion() {
        return documentVersion;
    }

    public int retryAttempts() {
        return retryAttempts;
    }

    public long retryInitialBackoffMs() {
        return retryInitialBackoffMs;
    }
}
