package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatMessage;
import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.PageContext;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
public class ChatPromptBuilder {
    private static final int MAX_HISTORY_ITEMS = 6;

    public String systemInstruction() {
        return """
                You are EduConnect AI Assistant.
                Answer in Vietnamese with clear accents.
                Stay within EduConnect: tutoring, public classes, registration, login, tutor application, contracts, escrow/payment explanation, complaints, support, navigation, and AI matching explanation.
                Do not invent private data, tutors, classes, schedules, contracts, homework, payments, or matching results.
                Do not claim private tools, live matching, or account lookup is available unless the system explicitly provides that tool.
                If the user asks for personal data, tell them to log in and use the relevant page.
                If the request is unrelated to EduConnect, politely refuse in one or two sentences.
                Keep answers concise and helpful.
                """;
    }

    public String buildPrompt(String message, List<ChatMessage> conversation, PageContext pageContext) {
        StringBuilder prompt = new StringBuilder();
        if (pageContext != null && StringUtils.hasText(pageContext.currentRoute())) {
            prompt.append("Current safe page context: route=")
                    .append(pageContext.currentRoute());
            if (StringUtils.hasText(pageContext.pageType())) {
                prompt.append(", pageType=").append(pageContext.pageType());
            }
            prompt.append("\n\n");
        }

        List<ChatMessage> safeHistory = conversation == null
                ? List.of()
                : conversation.stream()
                .filter(item -> item != null && item.role() != null && StringUtils.hasText(item.content()))
                .skip(Math.max(0, conversation.size() - MAX_HISTORY_ITEMS))
                .toList();
        if (!safeHistory.isEmpty()) {
            prompt.append("Recent conversation:\n");
            for (ChatMessage item : safeHistory) {
                prompt.append(item.role()).append(": ")
                        .append(limit(item.content(), 600))
                        .append('\n');
            }
            prompt.append('\n');
        }

        prompt.append("User message:\n").append(limit(message, 1200));
        return prompt.toString();
    }

    public String buildGroundedPrompt(
            String message,
            List<ChatMessage> conversation,
            PageContext pageContext,
            List<KnowledgeSearchHit> context
    ) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("""
                Answer the user's EduConnect question using only the EduConnect context below.
                Do not invent EduConnect policies, user data, tutors, classes, schedules, contracts, payments, or matching results.
                If the context does not define the answer clearly, say the available EduConnect information does not describe it clearly.
                Do not expose source file paths, Qdrant data, vector scores, or internal metadata.
                Keep the answer concise and natural Vietnamese.
                Preserve role and privacy restrictions.

                Retrieved EduConnect context:
                """);

        int sourceNumber = 1;
        for (KnowledgeSearchHit hit : context == null ? List.<KnowledgeSearchHit>of() : context) {
            prompt.append("SOURCE ").append(sourceNumber++).append('\n')
                    .append("Title: ").append(limit(hit.title(), 120)).append('\n')
                    .append("Section: ").append(limit(hit.section(), 160)).append('\n')
                    .append("Content:\n").append(limit(hit.content(), 1800)).append("\n\n");
        }

        prompt.append(buildPrompt(message, conversation, pageContext));
        return prompt.toString();
    }

    private String limit(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= maxLength) {
            return trimmed;
        }
        return trimmed.substring(0, maxLength);
    }
}
