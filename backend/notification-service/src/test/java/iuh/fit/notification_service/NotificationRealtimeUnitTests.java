package iuh.fit.notification_service;

import iuh.fit.notification_service.config.security.NotificationPrincipal;
import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.realtime.NotificationRealtimeEvent;
import iuh.fit.notification_service.realtime.NotificationRealtimeHub;
import iuh.fit.notification_service.realtime.NotificationRealtimePublisher;
import iuh.fit.notification_service.repository.NotificationRepository;
import iuh.fit.notification_service.service.NotificationCommand;
import iuh.fit.notification_service.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationRealtimeUnitTests {
    @Test
    void savedNotificationTriggersRealtimePublish() {
        NotificationRepository repository = mock(NotificationRepository.class);
        NotificationRealtimePublisher publisher = mock(NotificationRealtimePublisher.class);
        NotificationService service = new NotificationService(repository, publisher);

        when(repository.findByEventIdAndRecipientUserId("event-1", 10L)).thenReturn(Optional.empty());
        when(repository.saveAndFlush(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.createIfAbsent(command("event-1", 10L));

        verify(publisher).publishCreated(any(Notification.class));
    }

    @Test
    void duplicateNotificationDoesNotPublishRealtimeTwice() {
        NotificationRepository repository = mock(NotificationRepository.class);
        NotificationRealtimePublisher publisher = mock(NotificationRealtimePublisher.class);
        NotificationService service = new NotificationService(repository, publisher);
        Notification existing = notification(10L);

        when(repository.findByEventIdAndRecipientUserId("event-2", 10L)).thenReturn(Optional.of(existing));

        service.createIfAbsent(command("event-2", 10L));

        verify(repository, never()).saveAndFlush(any(Notification.class));
        verify(publisher, never()).publishCreated(any(Notification.class));
    }

    @Test
    void websocketPublishFailureDoesNotEscapePublisher() {
        NotificationRealtimeHub hub = mock(NotificationRealtimeHub.class);
        NotificationRealtimePublisher publisher = new NotificationRealtimePublisher(hub);
        Notification notification = notification(20L);

        org.mockito.Mockito.doThrow(new RuntimeException("transport down"))
                .when(hub)
                .publishToUser(any(), any());

        assertThatCode(() -> publisher.publishCreated(notification)).doesNotThrowAnyException();
    }

    @Test
    void realtimeHubSendsOnlyToRecipientUser() throws Exception {
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        NotificationRealtimeHub hub = new NotificationRealtimeHub(objectMapper);
        WebSocketSession recipient = session(10L);
        WebSocketSession otherUser = session(11L);

        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        hub.afterConnectionEstablished(recipient);
        hub.afterConnectionEstablished(otherUser);

        hub.publishToUser(10L, event(10L));

        verify(recipient).sendMessage(any(TextMessage.class));
        verify(otherUser, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void realtimeHubRejectsUnauthenticatedSession() throws Exception {
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        NotificationRealtimeHub hub = new NotificationRealtimeHub(objectMapper);
        WebSocketSession session = mock(WebSocketSession.class);

        when(session.getPrincipal()).thenReturn(null);

        hub.afterConnectionEstablished(session);

        verify(session).close(any(CloseStatus.class));
    }

    private NotificationCommand command(String eventId, Long recipientUserId) {
        return new NotificationCommand(
                eventId,
                recipientUserId,
                "TUTOR_APPLICATION_REVIEWED",
                "Title",
                "Message",
                "TUTOR",
                "TUTOR_APPLICATION",
                "99"
        );
    }

    private Notification notification(Long recipientUserId) {
        Notification notification = new Notification();
        notification.setEventId("event-" + recipientUserId);
        notification.setRecipientUserId(recipientUserId);
        notification.setType("TUTOR_APPLICATION_REVIEWED");
        notification.setTitle("Title");
        notification.setMessage("Message");
        notification.setTargetRole("TUTOR");
        notification.setReferenceType("TUTOR_APPLICATION");
        notification.setReferenceId("99");
        notification.setCreatedAt(LocalDateTime.now());
        return notification;
    }

    private NotificationRealtimeEvent event(Long recipientUserId) {
        return new NotificationRealtimeEvent(
                "notification-service",
                "NOTIFICATION_CREATED",
                1L,
                "TUTOR_APPLICATION_REVIEWED",
                recipientUserId,
                "TUTOR",
                "TUTOR_APPLICATION",
                "99",
                "Title",
                "Message",
                LocalDateTime.now()
        );
    }

    private WebSocketSession session(Long userId) {
        WebSocketSession session = mock(WebSocketSession.class);
        var principal = new NotificationPrincipal(userId, "user" + userId + "@example.com", "TUTOR", List.of("TUTOR"));
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of());

        when(session.getPrincipal()).thenReturn(authentication);
        when(session.isOpen()).thenReturn(true);
        return session;
    }
}
