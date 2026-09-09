package iuh.fit.notification_service.config.security;

import java.util.List;

public record NotificationPrincipal(
        Long userId,
        String email,
        String activeRole,
        List<String> roles
) {
}
