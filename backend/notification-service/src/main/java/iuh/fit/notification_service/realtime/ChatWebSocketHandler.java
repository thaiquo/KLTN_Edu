package iuh.fit.notification_service.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.notification_service.dto.ChatMessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import org.springframework.security.core.Authentication;
import iuh.fit.notification_service.config.security.NotificationPrincipal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private final ObjectMapper objectMapper;
    private final Map<String, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();

    public ChatWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userEmail = authenticatedEmail(session);
        if (userEmail != null && !userEmail.isBlank()) {
            userSessions.computeIfAbsent(userEmail.toLowerCase(Locale.ROOT), k -> new CopyOnWriteArraySet<>()).add(session);
            log.info("WebSocket /ws/chat connected for user: {} (session: {})", userEmail, session.getId());
        } else {
            try { session.close(CloseStatus.POLICY_VIOLATION); } catch (IOException ignored) { }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userEmail = authenticatedEmail(session);
        if (userEmail != null && !userEmail.isBlank()) {
            Set<WebSocketSession> set = userSessions.get(userEmail.toLowerCase(Locale.ROOT));
            if (set != null) {
                set.remove(session);
                if (set.isEmpty()) {
                    userSessions.remove(userEmail.toLowerCase(Locale.ROOT));
                }
            }
        }
        log.info("WebSocket /ws/chat closed (session: {})", session.getId());
    }

    public void pushChatMessage(ChatMessageDto message) {
        if (message == null) return;
        Map<String, Object> payload = Map.of(
                "type", "NEW_MESSAGE",
                "message", message
        );
        // Send to both recipient and sender (for sync across multiple tabs/devices)
        if (message.getRecipientEmail() != null) {
            sendToUser(message.getRecipientEmail(), payload);
        }
        if (message.getSenderEmail() != null) {
            sendToUser(message.getSenderEmail(), payload);
        }
    }

    private void sendToUser(String email, Map<String, Object> payload) {
        Set<WebSocketSession> sessions = userSessions.get(email.toLowerCase(Locale.ROOT));
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(payload);
            TextMessage textMessage = new TextMessage(json);
            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    try {
                        synchronized (session) { session.sendMessage(textMessage); }
                    } catch (IOException e) {
                        log.warn("Failed to send chat message to session {}: {}", session.getId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to serialize chat message payload", e);
        }
    }

    private String authenticatedEmail(WebSocketSession session) {
        if (session.getPrincipal() instanceof Authentication authentication
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof NotificationPrincipal principal) {
            return principal.email();
        }
        return null;
    }
}
