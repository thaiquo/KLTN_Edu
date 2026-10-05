package iuh.fit.notification_service;

import iuh.fit.notification_service.config.security.NotificationPrincipal;
import iuh.fit.notification_service.dto.ChatMessageDto;
import iuh.fit.notification_service.realtime.ChatWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ChatWebSocketHandlerTest {

    @Test
    void unauthenticatedSessionIsClosed() throws Exception {
        ChatWebSocketHandler handler = new ChatWebSocketHandler(mock(ObjectMapper.class));
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getPrincipal()).thenReturn(null);

        handler.afterConnectionEstablished(session);

        verify(session).close(any(CloseStatus.class));
    }

    @Test
    void newMessageIsDeliveredOnlyToSenderAndRecipientUserIds() throws Exception {
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        ChatWebSocketHandler handler = new ChatWebSocketHandler(objectMapper);
        WebSocketSession sender = session(1L);
        WebSocketSession recipient = session(2L);
        WebSocketSession other = session(3L);
        handler.afterConnectionEstablished(sender);
        handler.afterConnectionEstablished(recipient);
        handler.afterConnectionEstablished(other);

        handler.pushChatMessage(ChatMessageDto.builder()
                .id(UUID.randomUUID())
                .conversationId(UUID.randomUUID())
                .senderId(1L)
                .senderEmail("sender@test.com")
                .recipientId(2L)
                .recipientEmail("recipient@test.com")
                .content("Xin chao")
                .createdAt(OffsetDateTime.now())
                .build());

        verify(sender).sendMessage(any(TextMessage.class));
        verify(recipient).sendMessage(any(TextMessage.class));
        verify(other, never()).sendMessage(any(TextMessage.class));
    }

    private WebSocketSession session(Long userId) {
        WebSocketSession session = mock(WebSocketSession.class);
        var principal = new NotificationPrincipal(userId, "user" + userId + "@test.com", "STUDENT", List.of("STUDENT"));
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        when(session.getPrincipal()).thenReturn(authentication);
        when(session.isOpen()).thenReturn(true);
        when(session.getId()).thenReturn("session-" + userId);
        return session;
    }
}
