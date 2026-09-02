package iuh.fit.notification_service.realtime;

import iuh.fit.notification_service.config.security.NotificationPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotificationRealtimeHub extends TextWebSocketHandler {
    private static final Logger log = LoggerFactory.getLogger(NotificationRealtimeHub.class);

    private final ObjectMapper objectMapper;
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    public NotificationRealtimeHub(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long userId = userId(session);
        if (userId == null) {
            closeUnauthenticated(session);
            return;
        }
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

    public void publishToUser(Long recipientUserId, NotificationRealtimeEvent event) {
        if (recipientUserId == null || event == null) {
            return;
        }

        try {
            String json = objectMapper.writeValueAsString(event);
            for (WebSocketSession session : sessions) {
                if (!session.isOpen() || !recipientUserId.equals(userId(session))) {
                    continue;
                }
                try {
                    synchronized (session) {
                        session.sendMessage(new TextMessage(json));
                    }
                } catch (IOException ex) {
                    sessions.remove(session);
                    log.debug("Removed failed notification websocket session", ex);
                }
            }
        } catch (Exception ex) {
            log.warn("Notification websocket delivery failed for recipientUserId={}", recipientUserId, ex);
        }
    }

    private Long userId(WebSocketSession session) {
        if (!(session.getPrincipal() instanceof Authentication authentication)) {
            return null;
        }
        if (authentication.getPrincipal() instanceof NotificationPrincipal principal) {
            return principal.userId();
        }
        return null;
    }

    private void closeUnauthenticated(WebSocketSession session) {
        try {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication is required"));
        } catch (IOException ex) {
            log.debug("Failed to close unauthenticated notification websocket session", ex);
        }
    }
}
