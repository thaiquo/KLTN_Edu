package iuh.fit.ai_service.chatbot.dto;

import iuh.fit.ai_service.chatbot.model.ChatIntent;
import iuh.fit.ai_service.chatbot.model.ChatRole;
import iuh.fit.ai_service.chatbot.model.NavigationAction;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public final class ChatbotDtos {
    private ChatbotDtos() {
    }

    public record ChatRequest(
            @NotBlank(message = "message is required")
            @Size(max = 1200, message = "message must be at most 1200 characters")
            String message,
            List<@Valid ChatMessage> conversation,
            @Valid PageContext pageContext
    ) {
    }

    public record ChatMessage(
            ChatRole role,
            @Size(max = 1200, message = "conversation message content must be at most 1200 characters")
            String content
    ) {
    }

    public record PageContext(
            @Size(max = 160, message = "currentRoute must be at most 160 characters")
            String currentRoute,
            @Size(max = 80, message = "pageType must be at most 80 characters")
            String pageType
    ) {
    }

    public record ChatResponse(
            String message,
            ChatIntent intent,
            List<SourceReference> sources,
            List<ChatAction> actions,
            Map<String, Object> toolResult
    ) {
    }

    public record SourceReference(
            String title,
            String section,
            String type
    ) {
    }

    public record ChatAction(
            NavigationAction id,
            String label
    ) {
    }
}
