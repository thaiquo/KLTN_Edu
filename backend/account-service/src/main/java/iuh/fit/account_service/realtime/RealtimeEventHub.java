package iuh.fit.account_service.realtime;

import tools.jackson.databind.ObjectMapper;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RealtimeEventHub extends TextWebSocketHandler {
    private static final Set<String> REVIEWER_ROLES = Set.of("ROLE_STAFF", "ROLE_ADMIN");

    private final ObjectMapper objectMapper;
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    public RealtimeEventHub(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        sessions.remove(session);
    }

    public void publishToReviewers(String type, Long entityId, Map<String, ?> payload) {
        afterCommit(() -> send(type, entityId, payload, this::isReviewer));
    }

    public void publishToUser(String email, String type, Long entityId, Map<String, ?> payload) {
        afterCommit(() -> send(type, entityId, payload,
                session -> session.getPrincipal() != null && session.getPrincipal().getName().equalsIgnoreCase(email)));
    }

    private void send(String type, Long entityId, Map<String, ?> payload,
                      java.util.function.Predicate<WebSocketSession> recipient) {
        try {
            String json = objectMapper.writeValueAsString(Map.of(
                    "source", "account-service",
                    "type", type,
                    "entityId", entityId,
                    "occurredAt", Instant.now().toString(),
                    "payload", payload == null ? Map.of() : payload
            ));
            for (WebSocketSession session : sessions) {
                if (!session.isOpen() || !recipient.test(session)) continue;
                try {
                    synchronized (session) {
                        session.sendMessage(new TextMessage(json));
                    }
                } catch (IOException ignored) {
                    sessions.remove(session);
                }
            }
        } catch (Exception ignored) {
            // Realtime delivery must never roll back the business operation.
        }
    }

    private boolean isReviewer(WebSocketSession session) {
        if (!(session.getPrincipal() instanceof Authentication authentication)) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> REVIEWER_ROLES.contains(authority.getAuthority()));
    }

    private void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
