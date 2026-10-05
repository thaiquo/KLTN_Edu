package iuh.fit.notification_service;

import iuh.fit.notification_service.entity.ChatAttachment;
import iuh.fit.notification_service.entity.ChatMessage;
import iuh.fit.notification_service.entity.ChatMessageType;
import iuh.fit.notification_service.service.ChatNotificationService;
import iuh.fit.notification_service.service.ChatViewPresenceService;
import iuh.fit.notification_service.service.NotificationCommand;
import iuh.fit.notification_service.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ChatNotificationServiceTest {
    private ChatViewPresenceService presenceService;
    private NotificationService notificationService;
    private ChatNotificationService chatNotificationService;

    @BeforeEach
    void setUp() {
        presenceService = mock(ChatViewPresenceService.class);
        notificationService = mock(NotificationService.class);
        chatNotificationService = new ChatNotificationService(presenceService, notificationService);
    }

    @Test
    void outsideMessagesCreatesChatNotificationWithConversationReference() {
        ChatMessage message = message(ChatMessageType.TEXT, 1L, 2L);
        when(presenceService.isChatViewActive(2L)).thenReturn(false);

        chatNotificationService.publishAfterCommit(message, "Nguyen Van A", "TUTOR");

        NotificationCommand command = captureCommand();
        assertThat(command.eventId()).isEqualTo("chat-message:" + message.getId());
        assertThat(command.recipientUserId()).isEqualTo(2L);
        assertThat(command.type()).isEqualTo("CHAT_MESSAGE");
        assertThat(command.targetRole()).isEqualTo("TUTOR");
        assertThat(command.referenceType()).isEqualTo("CHAT_CONVERSATION");
        assertThat(command.referenceId()).isEqualTo(message.getConversationId().toString());
        assertThat(command.message()).isEqualTo("Nguyen Van A đã gửi cho bạn một tin nhắn");
    }

    @Test
    void insideMessagesSuppressesChatNotification() {
        ChatMessage message = message(ChatMessageType.TEXT, 1L, 2L);
        when(presenceService.isChatViewActive(2L)).thenReturn(true);

        chatNotificationService.publishAfterCommit(message, "Nguyen Van A", "TUTOR");

        verify(notificationService, never()).createIfAbsent(any());
    }

    @Test
    void senderDoesNotReceiveOwnNotification() {
        ChatMessage message = message(ChatMessageType.TEXT, 1L, 1L);

        chatNotificationService.publishAfterCommit(message, "Nguyen Van A", "STUDENT");

        verify(notificationService, never()).createIfAbsent(any());
    }

    @Test
    void groupedImagesCreateOneNotificationWithImageCount() {
        ChatMessage message = message(ChatMessageType.IMAGE, 1L, 2L);
        for (int i = 0; i < 5; i++) {
            message.addAttachment(ChatAttachment.builder()
                    .id(UUID.randomUUID())
                    .objectKey("chat/image-" + i)
                    .originalName(i + ".png")
                    .contentType("image/png")
                    .size(10L)
                    .sha256("a".repeat(64))
                    .build());
        }
        when(presenceService.isChatViewActive(2L)).thenReturn(false);

        chatNotificationService.publishAfterCommit(message, "Nguyen Van A", "TUTOR");

        NotificationCommand command = captureCommand();
        assertThat(command.message()).isEqualTo("Nguyen Van A đã gửi 5 hình ảnh");
        verify(notificationService).createIfAbsent(any());
    }

    @Test
    void videoCreatesOneNotification() {
        ChatMessage message = message(ChatMessageType.VIDEO, 1L, 2L);
        when(presenceService.isChatViewActive(2L)).thenReturn(false);

        chatNotificationService.publishAfterCommit(message, "Nguyen Van A", "TUTOR");

        NotificationCommand command = captureCommand();
        assertThat(command.message()).isEqualTo("Nguyen Van A đã gửi một video");
        verify(notificationService).createIfAbsent(any());
    }

    @Test
    void notificationFailureDoesNotEscapeChatFlow() {
        ChatMessage message = message(ChatMessageType.TEXT, 1L, 2L);
        when(presenceService.isChatViewActive(2L)).thenReturn(false);
        doThrow(new IllegalStateException("notification store down"))
                .when(notificationService)
                .createIfAbsent(any());

        assertThatCode(() -> chatNotificationService.publishAfterCommit(message, "Nguyen Van A", "TUTOR"))
                .doesNotThrowAnyException();
    }

    @Test
    void presenceContextBelongsToOneAuthenticatedUser() {
        ChatViewPresenceService service = new ChatViewPresenceService();
        service.update(2L, "tab-a", true);

        assertThat(service.isChatViewActive(2L)).isTrue();
        assertThat(service.isChatViewActive(3L)).isFalse();

        service.update(2L, "tab-a", false);

        assertThat(service.isChatViewActive(2L)).isFalse();
    }

    private NotificationCommand captureCommand() {
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(notificationService).createIfAbsent(captor.capture());
        return captor.getValue();
    }

    private ChatMessage message(ChatMessageType type, Long senderId, Long recipientId) {
        return ChatMessage.builder()
                .id(UUID.randomUUID())
                .conversationId(UUID.randomUUID())
                .senderId(senderId)
                .senderEmail("sender@test.com")
                .recipientId(recipientId)
                .recipientEmail("recipient@test.com")
                .type(type)
                .content(type == ChatMessageType.TEXT ? "Hello" : "")
                .isRead(false)
                .build();
    }
}

