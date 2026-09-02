package iuh.fit.learning_service.config.security;

import java.security.Principal;

public record LearningUserPrincipal(
        String email,
        Long userId,
        String activeRole
) implements Principal {
    @Override
    public String getName() {
        return email;
    }
}
