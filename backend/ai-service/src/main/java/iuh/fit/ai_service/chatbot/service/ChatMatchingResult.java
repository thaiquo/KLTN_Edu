package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatAction;

import java.util.List;
import java.util.Map;

public record ChatMatchingResult(
        String message,
        List<ChatAction> actions,
        Map<String, Object> toolResult
) {
}
