package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ChatRagRetrieverTest {
    private final EmbeddingService embeddingService = mock(EmbeddingService.class);
    private final ChatKnowledgeVectorStore vectorStore = mock(ChatKnowledgeVectorStore.class);
    private final ChatKnowledgeProperties properties = new ChatKnowledgeProperties(
            "docs/chatbot-knowledge",
            "educonnect_chatbot_knowledge_v1",
            3,
            4,
            0.35,
            1
    );
    private final ChatRagRetriever retriever = new ChatRagRetriever(embeddingService, vectorStore, properties);

    @Test
    void embedsQuerySearchesQdrantWithGuestRoleFilterAndTopK() {
        EmbeddingVector vector = new EmbeddingVector(List.of(0.1f, 0.2f, 0.3f));
        KnowledgeSearchHit hit = new KnowledgeSearchHit("id", "overview", "Tổng quan", "EduConnect là gì?", "overview", "content", 0.8);
        when(embeddingService.embed("EduConnect là gì?")).thenReturn(vector);
        when(vectorStore.search(eq(vector), any(), eq(2), eq(0.35))).thenReturn(List.of(hit));

        List<KnowledgeSearchHit> results = retriever.retrieve("EduConnect là gì?", AiUserContext.guest(), 2);

        assertThat(results).containsExactly(hit);
        verify(vectorStore).search(eq(vector), org.mockito.ArgumentMatchers.argThat(roles ->
                roles.contains("PUBLIC") && roles.contains("GUEST")), eq(2), eq(0.35));
    }

    @Test
    void emptyQueryDoesNotEmbedOrSearch() {
        List<KnowledgeSearchHit> results = retriever.retrieve("   ", AiUserContext.guest(), 2);

        assertThat(results).isEmpty();
        verifyNoInteractions(embeddingService, vectorStore);
    }
}
