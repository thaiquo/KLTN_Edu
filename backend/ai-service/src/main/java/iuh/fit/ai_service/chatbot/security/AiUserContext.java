package iuh.fit.ai_service.chatbot.security;

import java.util.List;

public record AiUserContext(
        Long userId,
        String email,
        String activeRole,
        List<String> roles,
        boolean authenticated
) {
    public static AiUserContext guest() {
        return new AiUserContext(null, null, "GUEST", List.of("GUEST"), false);
    }

    public boolean hasActiveRole(String role) {
        return activeRole != null && activeRole.equalsIgnoreCase(role);
    }
}
