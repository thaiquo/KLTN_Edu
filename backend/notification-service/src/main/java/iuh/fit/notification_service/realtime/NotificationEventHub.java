package iuh.fit.notification_service.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.notification_service.dto.NotificationDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class NotificationEventHub extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventHub.class);

    private final ObjectMapper objectMapper;
    private final Set<WebSocketSession> activeSessions = new CopyOnWriteArraySet<>();
    private final Map<String, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();

    public NotificationEventHub(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        activeSessions.add(session);
        String userEmail = extractEmailFromQuery(session.getUri());
        if (userEmail != null && !userEmail.isBlank()) {
            userSessions.computeIfAbsent(userEmail.toLowerCase(Locale.ROOT), k -> new CopyOnWriteArraySet<>()).add(session);
            log.info("WebSocket /ws/notifications connected for user: {} (session: {})", userEmail, session.getId());
        } else {
            log.info("WebSocket /ws/notifications connected anonymous (session: {})", session.getId());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        activeSessions.remove(session);
        String userEmail = extractEmailFromQuery(session.getUri());
        if (userEmail != null && !userEmail.isBlank()) {
            Set<WebSocketSession> set = userSessions.get(userEmail.toLowerCase(Locale.ROOT));
            if (set != null) {
                set.remove(session);
                if (set.isEmpty()) {
                    userSessions.remove(userEmail.toLowerCase(Locale.ROOT));
                }
            }
        }
        log.info("WebSocket /ws/notifications closed (session: {})", session.getId());
    }

    public void pushNotification(NotificationDto notification) {
        if (notification == null || notification.getRecipientEmail() == null) {
            return;
        }
        String recipient = notification.getRecipientEmail().toLowerCase(Locale.ROOT);
        Map<String, Object> payload = Map.of(
                "type", "NOTIFICATION_RECEIVED",
                "notification", notification
        );
        sendToUser(recipient, payload);
    }

    public void broadcast(String eventType, Object data) {
        Map<String, Object> payload = Map.of(
                "type", eventType,
                "payload", data,
                "timestamp", System.currentTimeMillis()
        );
        broadcastToAll(payload);
    }

    private void sendToUser(String email, Map<String, Object> payload) {
        Set<WebSocketSession> sessions = userSessions.get(email.toLowerCase(Locale.ROOT));
        if (sessions == null || sessions.isEmpty()) {
            // Also broadcast to all active in case email was passed anonymously or via query re-connect
            broadcastToAll(payload);
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(payload);
            TextMessage message = new TextMessage(json);
            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(message);
                    } catch (IOException e) {
                        log.warn("Failed to send notification to user session {}: {}", session.getId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to serialize realtime notification payload", e);
        }
    }

    private void broadcastToAll(Map<String, Object> payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            TextMessage message = new TextMessage(json);
            for (WebSocketSession session : activeSessions) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(message);
                    } catch (IOException e) {
                        log.warn("Failed to broadcast realtime event to session {}: {}", session.getId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to broadcast realtime event", e);
        }
    }

    private String extractEmailFromQuery(URI uri) {
        if (uri == null || uri.getQuery() == null) return null;
        for (String param : uri.getQuery().split("&")) {
            String[] pair = param.split("=");
            if (pair.length == 2 && ("email".equalsIgnoreCase(pair[0]) || "userEmail".equalsIgnoreCase(pair[0]))) {
                try {
                    return java.net.URLDecoder.decode(pair[1], java.nio.charset.StandardCharsets.UTF_8);
                } catch (Exception ignored) {}
            }
        }
        return null;
    }
}
