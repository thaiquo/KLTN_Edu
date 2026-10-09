package iuh.fit.ai_service.chatbot.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AiUserContextResolver {
    public AiUserContext currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return AiUserContext.guest();
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof AiAuthenticatedPrincipal aiPrincipal) {
            return new AiUserContext(
                    aiPrincipal.userId(),
                    aiPrincipal.email(),
                    normalizeRole(aiPrincipal.activeRole()),
                    safeRoles(aiPrincipal.roles()),
                    true
            );
        }
        return AiUserContext.guest();
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "GUEST";
        }
        return role.trim().toUpperCase();
    }

    private List<String> safeRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return List.of();
        }
        return roles.stream()
                .filter(role -> role != null && !role.isBlank())
                .map(role -> role.trim().toUpperCase())
                .distinct()
                .toList();
    }
}
