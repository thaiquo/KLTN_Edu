package iuh.fit.notification_service;

import iuh.fit.notification_service.dto.ChatMessageDto;
import iuh.fit.notification_service.dto.SendMessageRequest;
import iuh.fit.notification_service.entity.ChatMessage;
import iuh.fit.notification_service.entity.Conversation;
import iuh.fit.notification_service.realtime.ChatWebSocketHandler;
import iuh.fit.notification_service.repository.ChatMessageRepository;
import iuh.fit.notification_service.repository.ConversationRepository;
import iuh.fit.notification_service.service.ChatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ChatServiceTest {

    private ConversationRepository conversationRepository;
    private ChatMessageRepository messageRepository;
    private ChatWebSocketHandler chatWebSocketHandler;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        conversationRepository = mock(ConversationRepository.class);
        messageRepository = mock(ChatMessageRepository.class);
        chatWebSocketHandler = mock(ChatWebSocketHandler.class);
        chatService = new ChatService(conversationRepository, messageRepository, chatWebSocketHandler);
    }

    @Test
    void sendMessageCreatesConversationAndBroadcasts() {
        UUID convId = UUID.randomUUID();
        Conversation conv = Conversation.builder()
                .id(convId)
                .participant1Id(1L)
                .participant1Email("student@test.com")
                .participant2Id(2L)
                .participant2Email("tutor@test.com")
                .lastMessage("")
                .lastMessageTime(OffsetDateTime.now())
                .build();

        when(conversationRepository.findBetweenUsers("student@test.com", "tutor@test.com"))
                .thenReturn(Optional.of(conv));

        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            m.setId(UUID.randomUUID());
            m.setCreatedAt(OffsetDateTime.now());
            return m;
        });

        SendMessageRequest request = SendMessageRequest.builder()
                .recipientId(2L)
                .recipientEmail("tutor@test.com")
                .content("Xin chào gia sư!")
                .build();

        ChatMessageDto result = chatService.sendMessage(1L, "student@test.com", request);

        assertThat(result.getContent()).isEqualTo("Xin chào gia sư!");
        assertThat(result.getSenderEmail()).isEqualTo("student@test.com");
        assertThat(result.getRecipientEmail()).isEqualTo("tutor@test.com");

        verify(messageRepository).save(any(ChatMessage.class));
        verify(conversationRepository).save(any(Conversation.class));
        verify(chatWebSocketHandler).pushChatMessage(any(ChatMessageDto.class));
    }
}
