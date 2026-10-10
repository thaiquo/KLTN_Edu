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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private final ObjectMapper objectMapper;
    private final Map<Long, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();

    public ChatWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long userId = authenticatedUserId(session);
        if (userId != null) {
            userSessions.computeIfAbsent(userId, k -> new CopyOnWriteArraySet<>()).add(session);
            log.debug("WebSocket /ws/chat connected for userId: {} (session: {})", userId, session.getId());
        } else {
            try { session.close(CloseStatus.POLICY_VIOLATION); } catch (IOException ignored) { }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = authenticatedUserId(session);
        if (userId != null) {
            Set<WebSocketSession> set = userSessions.get(userId);
            if (set != null) {
                set.remove(session);
                if (set.isEmpty()) {
                    userSessions.remove(userId);
                }
            }
        }
        log.debug("WebSocket /ws/chat closed (session: {})", session.getId());
    }

    public void pushChatMessage(ChatMessageDto message) {
        if (message == null) return;
        Map<String, Object> messagePayload = new LinkedHashMap<>();
        messagePayload.put("messageId", message.getId());
        messagePayload.put("conversationId", message.getConversationId());
        messagePayload.put("senderUserId", message.getSenderId());
        messagePayload.put("type", message.getType());
        messagePayload.put("content", message.getContent());
        messagePayload.put("sharedResourceType", message.getSharedResourceType());
        messagePayload.put("sharedResourcePublicId", message.getSharedResourcePublicId());
        messagePayload.put("attachments", message.getAttachments());
        messagePayload.put("createdAt", message.getCreatedAt());
        messagePayload.put("read", message.isRead());

        Map<String, Object> payload = Map.of(
                "type", "NEW_MESSAGE",
                "payload", messagePayload
        );
        // Send to both recipient and sender (for sync across multiple tabs/devices)
        if (message.getRecipientId() != null) {
            sendToUser(message.getRecipientId(), payload);
        }
        if (message.getSenderId() != null) {
            sendToUser(message.getSenderId(), payload);
        }
    }

    private void sendToUser(Long userId, Map<String, Object> payload) {
        Set<WebSocketSession> sessions = userSessions.get(userId);
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

    private Long authenticatedUserId(WebSocketSession session) {
        if (session.getPrincipal() instanceof Authentication authentication
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof NotificationPrincipal principal) {
            return principal.userId();
        }
        return null;
    }
}
