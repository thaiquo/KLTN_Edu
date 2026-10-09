package iuh.fit.ai_service.chatbot.security;

import java.util.List;

public record AiAuthenticatedPrincipal(
        Long userId,
        String email,
        String activeRole,
        List<String> roles
) {
}
