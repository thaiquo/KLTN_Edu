package iuh.fit.contract_service.config.security;

import java.util.List;
import java.util.Locale;

public record ContractUserPrincipal(
        Long userId,
        String email,
        String activeRole,
        List<String> roles
) {
    public ContractUserPrincipal {
        email = email != null ? email.trim() : "";
        activeRole = normalize(activeRole);
        roles = roles == null ? List.of() : roles.stream()
                .map(ContractUserPrincipal::normalize)
                .filter(role -> !role.isBlank())
                .distinct()
                .toList();
    }

    public boolean hasRole(String role) {
        return roles.contains(normalize(role));
    }

    public boolean hasActiveRole(String role) {
        return activeRole.equals(normalize(role));
    }

    public boolean hasActiveAuthority(String role) {
        return hasActiveRole(role) && hasRole(role);
    }

    public boolean matchesUserId(Long otherUserId) {
        return userId != null && otherUserId != null && userId.equals(otherUserId);
    }

    public boolean matchesEmail(String otherEmail) {
        return !email.isBlank() && otherEmail != null && email.equalsIgnoreCase(otherEmail.trim());
    }

    private static String normalize(String role) {
        if (role == null) {
            return "";
        }
        return role.replace("ROLE_", "").trim().toUpperCase(Locale.ROOT);
    }
}
