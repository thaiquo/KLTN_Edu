package iuh.fit.notification_service.service;

import iuh.fit.notification_service.dto.ChatMessageDto;
import iuh.fit.notification_service.dto.ConversationDto;
import iuh.fit.notification_service.dto.SendMessageRequest;
import iuh.fit.notification_service.entity.ChatMessage;
import iuh.fit.notification_service.entity.Conversation;
import iuh.fit.notification_service.realtime.ChatWebSocketHandler;
import iuh.fit.notification_service.repository.ChatMessageRepository;
import iuh.fit.notification_service.repository.ConversationRepository;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatWebSocketHandler chatWebSocketHandler;

    public ChatService(ConversationRepository conversationRepository,
                       ChatMessageRepository messageRepository,
                       ChatWebSocketHandler chatWebSocketHandler) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.chatWebSocketHandler = chatWebSocketHandler;
    }

    @Transactional
    public ChatMessageDto sendMessage(Long senderId, String senderEmail, SendMessageRequest request) {
        Conversation conversation;
        if (request.getConversationId() != null) {
            conversation = conversationRepository.findById(request.getConversationId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        } else {
            conversation = getOrCreateConversation(senderId, senderEmail, request.getRecipientId(), request.getRecipientEmail());
        }

        requireParticipant(conversation, senderEmail);
        boolean firstParticipant = senderEmail.equalsIgnoreCase(conversation.getParticipant1Email());
        String recipientEmail = firstParticipant ? conversation.getParticipant2Email() : conversation.getParticipant1Email();
        Long recipientId = firstParticipant ? conversation.getParticipant2Id() : conversation.getParticipant1Id();
        if (!recipientEmail.equalsIgnoreCase(request.getRecipientEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient does not belong to this conversation");
        }
        ChatMessage message = ChatMessage.builder()
                .conversationId(conversation.getId())
                .senderId(senderId)
                .senderEmail(senderEmail)
                .recipientId(recipientId)
                .recipientEmail(recipientEmail)
                .content(request.getContent().trim())
                .isRead(false)
                .build();

        ChatMessage saved = messageRepository.save(message);

        // Update conversation last message
        conversation.setLastMessage(saved.getContent());
        conversation.setLastMessageTime(saved.getCreatedAt());
        conversation.setUpdatedAt(OffsetDateTime.now());
        conversationRepository.save(conversation);

        ChatMessageDto dto = toMessageDto(saved);

        // Push real-time to participants via WebSocket
        chatWebSocketHandler.pushChatMessage(dto);

        return dto;
    }

    @Transactional(readOnly = true)
    public List<ConversationDto> getUserConversations(String userEmail) {
        return conversationRepository.findByUserEmail(userEmail).stream()
                .map(c -> {
                    long unread = messageRepository.countByConversationIdAndRecipientEmailIgnoreCaseAndIsReadFalse(c.getId(), userEmail);
                    return ConversationDto.builder()
                            .id(c.getId())
                            .participant1Id(c.getParticipant1Id())
                            .participant1Email(c.getParticipant1Email())
                            .participant2Id(c.getParticipant2Id())
                            .participant2Email(c.getParticipant2Email())
                            .lastMessage(c.getLastMessage())
                            .lastMessageTime(c.getLastMessageTime())
                            .createdAt(c.getCreatedAt())
                            .updatedAt(c.getUpdatedAt())
                            .unreadCount(unread)
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public List<ChatMessageDto> getConversationMessages(UUID conversationId, String currentUserEmail) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        requireParticipant(conversation, currentUserEmail);
        // Mark unread messages in conversation as read
        messageRepository.markMessagesAsRead(conversationId, currentUserEmail);

        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId).stream()
                .map(this::toMessageDto)
                .collect(Collectors.toList());
    }

    private void requireParticipant(Conversation conversation, String email) {
        if (email == null || (!email.equalsIgnoreCase(conversation.getParticipant1Email())
                && !email.equalsIgnoreCase(conversation.getParticipant2Email()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conversation belongs to other users");
        }
    }

    private Conversation getOrCreateConversation(Long p1Id, String p1Email, Long p2Id, String p2Email) {
        return conversationRepository.findBetweenUsers(p1Email, p2Email)
                .orElseGet(() -> {
                    Conversation c = Conversation.builder()
                            .participant1Id(p1Id)
                            .participant1Email(p1Email)
                            .participant2Id(p2Id)
                            .participant2Email(p2Email)
                            .lastMessage("")
                            .lastMessageTime(OffsetDateTime.now())
                            .build();
                    return conversationRepository.save(c);
                });
    }

    private ChatMessageDto toMessageDto(ChatMessage m) {
        return ChatMessageDto.builder()
                .id(m.getId())
                .conversationId(m.getConversationId())
                .senderId(m.getSenderId())
                .senderEmail(m.getSenderEmail())
                .recipientId(m.getRecipientId())
                .recipientEmail(m.getRecipientEmail())
                .content(m.getContent())
                .isRead(m.isRead())
                .createdAt(m.getCreatedAt())
                .build();
    }
}
