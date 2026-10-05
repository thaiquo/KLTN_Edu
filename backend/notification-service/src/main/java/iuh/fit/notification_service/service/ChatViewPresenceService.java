package iuh.fit.notification_service.service;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChatViewPresenceService {
    private static final Duration CHAT_VIEW_TTL = Duration.ofSeconds(45);

    private final Map<Long, Map<String, Instant>> activeClientsByUser = new ConcurrentHashMap<>();

    public void update(Long userId, String clientId, boolean active) {
        if (userId == null) {
            return;
        }

        String normalizedClientId = normalizeClientId(clientId);
        if (!active) {
            Map<String, Instant> clients = activeClientsByUser.get(userId);
            if (clients != null) {
                clients.remove(normalizedClientId);
                if (clients.isEmpty()) {
                    activeClientsByUser.remove(userId, clients);
                }
            }
            return;
        }

        activeClientsByUser
                .computeIfAbsent(userId, ignored -> new ConcurrentHashMap<>())
                .put(normalizedClientId, Instant.now().plus(CHAT_VIEW_TTL));
    }

    public boolean isChatViewActive(Long userId) {
        if (userId == null) {
            return false;
        }

        Map<String, Instant> clients = activeClientsByUser.get(userId);
        if (clients == null || clients.isEmpty()) {
            return false;
        }

        Instant now = Instant.now();
        clients.entrySet().removeIf(entry -> entry.getValue().isBefore(now));
        if (clients.isEmpty()) {
            activeClientsByUser.remove(userId, clients);
            return false;
        }

        return true;
    }

    private String normalizeClientId(String clientId) {
        return StringUtils.hasText(clientId) ? clientId.trim() : "default";
    }
}

