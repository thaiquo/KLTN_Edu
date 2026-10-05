package iuh.fit.notification_service;

import iuh.fit.notification_service.client.AccountChatIdentityClient;
import iuh.fit.notification_service.client.AccountChatIdentityClient.ChatIdentity;
import iuh.fit.notification_service.config.security.NotificationPrincipal;
import iuh.fit.notification_service.dto.SendMessageRequest;
import iuh.fit.notification_service.dto.StartDirectConversationRequest;
import iuh.fit.notification_service.entity.ChatMessage;
import iuh.fit.notification_service.entity.ChatMessageType;
import iuh.fit.notification_service.entity.Conversation;
import iuh.fit.notification_service.realtime.ChatWebSocketHandler;
import iuh.fit.notification_service.repository.ChatMessageRepository;
import iuh.fit.notification_service.repository.ConversationRepository;
import iuh.fit.notification_service.service.ChatAttachmentPolicy;
import iuh.fit.notification_service.service.ChatNotificationService;
import iuh.fit.notification_service.service.ChatService;
import iuh.fit.notification_service.service.storage.ChatAttachmentStorage;
import iuh.fit.notification_service.service.storage.ChatAttachmentStorageException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.*;

class ChatServiceTest {

    private ConversationRepository conversationRepository;
    private ChatMessageRepository messageRepository;
    private ChatWebSocketHandler chatWebSocketHandler;
    private AccountChatIdentityClient accountClient;
    private ChatAttachmentStorage attachmentStorage;
    private ChatAttachmentPolicy attachmentPolicy;
    private ChatNotificationService chatNotificationService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        conversationRepository = mock(ConversationRepository.class);
        messageRepository = mock(ChatMessageRepository.class);
        chatWebSocketHandler = mock(ChatWebSocketHandler.class);
        accountClient = mock(AccountChatIdentityClient.class);
        attachmentStorage = mock(ChatAttachmentStorage.class);
        attachmentPolicy = new ChatAttachmentPolicy(new iuh.fit.notification_service.config.ChatAttachmentProperties(
                5,
                10L * 1024L * 1024L,
                40L * 1024L * 1024L
        ));
        chatNotificationService = mock(ChatNotificationService.class);
        chatService = new ChatService(conversationRepository, messageRepository, chatWebSocketHandler, accountClient,
                attachmentStorage, attachmentPolicy, chatNotificationService);
    }

    @Test
    void studentCreatesConversationWithApprovedTutor() {
        var student = principal(1L, "student@test.com", "STUDENT");
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(conversationRepository.findByParticipantLowUserIdAndParticipantHighUserId(1L, 2L))
                .thenReturn(Optional.empty());
        when(conversationRepository.saveAndFlush(any(Conversation.class))).thenAnswer(invocation -> {
            Conversation c = invocation.getArgument(0);
            c.setId(UUID.randomUUID());
            c.setCreatedAt(OffsetDateTime.now());
            c.setUpdatedAt(OffsetDateTime.now());
            return c;
        });

        var result = chatService.startDirectConversation(student, new StartDirectConversationRequest(2L));

        assertThat(result.getParticipant1Id()).isEqualTo(1L);
        assertThat(result.getParticipant2Id()).isEqualTo(2L);
        assertThat(result.getCounterpartUserId()).isEqualTo(2L);
        assertThat(result.getCounterpartRole()).isEqualTo("TUTOR");
    }

    @Test
    void repeatedAndReversedCreateReturnSameConversation() {
        var existing = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findByParticipantLowUserIdAndParticipantHighUserId(1L, 2L))
                .thenReturn(Optional.of(existing));
        when(messageRepository.countByConversationIdAndRecipientIdAndIsReadFalse(existing.getId(), 1L)).thenReturn(0L);
        when(messageRepository.countByConversationIdAndRecipientIdAndIsReadFalse(existing.getId(), 2L)).thenReturn(0L);
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));

        var first = chatService.startDirectConversation(principal(1L, "student@test.com", "STUDENT"),
                new StartDirectConversationRequest(2L));
        var second = chatService.startDirectConversation(principal(2L, "tutor@test.com", "TUTOR"),
                new StartDirectConversationRequest(1L));

        assertThat(first.getId()).isEqualTo(existing.getId());
        assertThat(second.getId()).isEqualTo(existing.getId());
        verify(conversationRepository, never()).saveAndFlush(any());
    }

    @Test
    void duplicateRaceFallsBackToExistingConversation() {
        var student = principal(1L, "student@test.com", "STUDENT");
        var existing = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(conversationRepository.findByParticipantLowUserIdAndParticipantHighUserId(1L, 2L))
                .thenReturn(Optional.empty(), Optional.of(existing));
        when(conversationRepository.saveAndFlush(any(Conversation.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate pair"));

        var result = chatService.startDirectConversation(student, new StartDirectConversationRequest(2L));

        assertThat(result.getId()).isEqualTo(existing.getId());
    }

    @Test
    void invalidDirectConversationPairsAreRejected() {
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(3L)).thenReturn(studentIdentity(3L));
        when(accountClient.getIdentity(4L)).thenReturn(unapprovedTutorIdentity(4L));
        when(conversationRepository.findByParticipantLowUserIdAndParticipantHighUserId(any(), any()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> chatService.startDirectConversation(principal(1L, "student@test.com", "STUDENT"),
                new StartDirectConversationRequest(1L)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");

        assertThatThrownBy(() -> chatService.startDirectConversation(principal(1L, "student@test.com", "STUDENT"),
                new StartDirectConversationRequest(3L)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");

        assertThatThrownBy(() -> chatService.startDirectConversation(principal(1L, "student@test.com", "STUDENT"),
                new StartDirectConversationRequest(4L)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void participantCanSendAndRecipientIsDerivedFromConversation() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage m = invocation.getArgument(0);
            m.setId(UUID.randomUUID());
            m.setCreatedAt(OffsetDateTime.now());
            return m;
        });

        SendMessageRequest request = SendMessageRequest.builder()
                .conversationId(conversation.getId())
                .recipientId(999L)
                .recipientEmail("spoof@test.com")
                .content("  Xin chao  ")
                .build();

        var result = chatService.sendMessage(principal(1L, "student@test.com", "STUDENT"), request);

        assertThat(result.getSenderId()).isEqualTo(1L);
        assertThat(result.getRecipientId()).isEqualTo(2L);
        assertThat(result.getRecipientEmail()).isEqualTo("tutor@test.com");
        assertThat(result.getContent()).isEqualTo("Xin chao");
        verify(chatWebSocketHandler).pushChatMessage(any());
        verify(chatNotificationService).publishAfterCommit(any(ChatMessage.class), eq("Student 1"), eq("TUTOR"));
    }

    @Test
    void messageStillReturnsWhenChatNotificationFails() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage m = invocation.getArgument(0);
            m.setId(UUID.randomUUID());
            m.setCreatedAt(OffsetDateTime.now());
            return m;
        });
        doThrow(new IllegalStateException("notification db down"))
                .when(chatNotificationService)
                .publishAfterCommit(any(ChatMessage.class), any(), any());

        var result = chatService.sendMessage(
                principal(1L, "student@test.com", "STUDENT"),
                SendMessageRequest.builder().conversationId(conversation.getId()).content("Hello").build());

        assertThat(result.getContent()).isEqualTo("Hello");
        verify(chatWebSocketHandler).pushChatMessage(any());
    }

    @Test
    void participantCanSendImageAttachment() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(attachmentStorage.put(any(), any(), eq("image/png"))).thenAnswer(invocation ->
                new ChatAttachmentStorage.StoredChatAttachment(invocation.getArgument(0), "image/png", ((byte[]) invocation.getArgument(1)).length));
        when(attachmentStorage.createPresignedGetUrl(any())).thenReturn("https://example.test/chat-image");
        when(messageRepository.saveAndFlush(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage m = invocation.getArgument(0);
            m.setCreatedAt(OffsetDateTime.now());
            return m;
        });

        var result = chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(pngFile("proof.png", 128)),
                "  ÄÃ¢y lÃ  bÃ i em Ä‘ang lÃ m  "
        );

        assertThat(result.getType()).isEqualTo("IMAGE");
        assertThat(result.getContent()).isEqualTo("ÄÃ¢y lÃ  bÃ i em Ä‘ang lÃ m");
        assertThat(result.getAttachments()).hasSize(1);
        assertThat(result.getAttachments().getFirst().getContentType()).isEqualTo("image/png");
        assertThat(result.getAttachments().getFirst().getUrl()).isEqualTo("https://example.test/chat-image");
        verify(chatWebSocketHandler).pushChatMessage(any());
        verify(conversationRepository).save(conversation);
        verify(chatNotificationService).publishAfterCommit(any(ChatMessage.class), eq("Student 1"), eq("TUTOR"));
        assertThat(conversation.getLastMessage()).contains("1").contains("h");
    }

    @Test
    void participantCanSendVideoAttachment() {
        var conversation = conversation(2L, "tutor@test.com", 1L, "student@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(attachmentStorage.put(any(), any(), eq("video/mp4"))).thenAnswer(invocation ->
                new ChatAttachmentStorage.StoredChatAttachment(invocation.getArgument(0), "video/mp4", ((byte[]) invocation.getArgument(1)).length));
        when(messageRepository.saveAndFlush(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage m = invocation.getArgument(0);
            m.setCreatedAt(OffsetDateTime.now());
            return m;
        });

        var result = chatService.sendAttachment(
                principal(2L, "tutor@test.com", "TUTOR"),
                conversation.getId(),
                List.of(mp4File("lesson.mp4", 128)),
                null
        );

        assertThat(result.getType()).isEqualTo("VIDEO");
        assertThat(result.getAttachments()).hasSize(1);
        assertThat(result.getAttachments().getFirst().getContentType()).isEqualTo("video/mp4");
        assertThat(conversation.getLastMessage()).contains("video");
        verify(chatNotificationService).publishAfterCommit(any(ChatMessage.class), eq("Tutor 2"), eq("STUDENT"));
    }

    @Test
    void participantCanSendFiveImagesAsOneMessage() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(attachmentStorage.put(any(), any(), eq("image/png"))).thenAnswer(invocation ->
                new ChatAttachmentStorage.StoredChatAttachment(invocation.getArgument(0), "image/png", ((byte[]) invocation.getArgument(1)).length));
        when(attachmentStorage.createPresignedGetUrl(any())).thenReturn("https://example.test/chat-image");
        when(messageRepository.saveAndFlush(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage m = invocation.getArgument(0);
            m.setCreatedAt(OffsetDateTime.now());
            return m;
        });

        var result = chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(
                        pngFile("1.png", 64),
                        pngFile("2.png", 64),
                        pngFile("3.png", 64),
                        pngFile("4.png", 64),
                        pngFile("5.png", 64)
                ),
                "group"
        );

        assertThat(result.getType()).isEqualTo("IMAGE");
        assertThat(result.getAttachments()).hasSize(5);
        assertThat(conversation.getLastMessage()).contains("5").contains("h");
        verify(attachmentStorage, times(5)).put(startsWith("chat/conversations/" + conversation.getId()), any(), eq("image/png"));
        verify(messageRepository).saveAndFlush(argThat(message ->
                message.getType() == ChatMessageType.IMAGE && message.getAttachments().size() == 5));
        verify(chatWebSocketHandler).pushChatMessage(any());
        verify(chatNotificationService, times(1)).publishAfterCommit(
                argThat(message -> message.getType() == ChatMessageType.IMAGE && message.getAttachments().size() == 5),
                eq("Student 1"),
                eq("TUTOR"));
    }

    @Test
    void invalidImageCountsVideoCountsAndMixedMediaAreRejectedBeforeStorage() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(
                        pngFile("1.png", 64),
                        pngFile("2.png", 64),
                        pngFile("3.png", 64),
                        pngFile("4.png", 64),
                        pngFile("5.png", 64),
                        pngFile("6.png", 64)
                ),
                null
        )).isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(mp4File("a.mp4", 64), mp4File("b.mp4", 64)),
                null
        )).isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(pngFile("a.png", 64), mp4File("b.mp4", 64)),
                null
        )).isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");

        verifyNoInteractions(attachmentStorage);
        verifyNoInteractions(chatWebSocketHandler);
    }

    @Test
    void oversizedVideoIsRejectedBeforeStorage() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(mp4File("huge.mp4", (40 * 1024 * 1024) + 1)),
                null
        )).isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");

        verifyNoInteractions(attachmentStorage);
        verifyNoInteractions(chatWebSocketHandler);
    }

    @Test
    void nonParticipantCannotUploadAttachment() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(9L, "outsider@test.com", "STUDENT"),
                conversation.getId(),
                List.of(pngFile("proof.png", 64)),
                null
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
        verifyNoInteractions(attachmentStorage);
        verifyNoInteractions(chatWebSocketHandler);
    }

    @Test
    void invalidAndOversizedAttachmentsAreRejectedBeforeStorage() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(new MockMultipartFile("file", "x.svg", "image/svg+xml", "<svg/>".getBytes())),
                null
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(pngFile("huge.png", (10 * 1024 * 1024) + 1)),
                null
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");

        verifyNoInteractions(attachmentStorage);
        verifyNoInteractions(chatWebSocketHandler);
    }

    @Test
    void storageFailureDoesNotPersistOrEmitMessage() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(attachmentStorage.put(any(), any(), any())).thenThrow(new ChatAttachmentStorageException("S3 down"));

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(pngFile("proof.png", 64)),
                null
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("502");

        verify(messageRepository, never()).saveAndFlush(any());
        verifyNoInteractions(chatWebSocketHandler);
    }

    @Test
    void partialGroupUploadFailureDeletesAlreadyUploadedObjects() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(attachmentStorage.put(any(), any(), any()))
                .thenAnswer(invocation -> new ChatAttachmentStorage.StoredChatAttachment(
                        invocation.getArgument(0),
                        invocation.getArgument(2),
                        ((byte[]) invocation.getArgument(1)).length))
                .thenAnswer(invocation -> new ChatAttachmentStorage.StoredChatAttachment(
                        invocation.getArgument(0),
                        invocation.getArgument(2),
                        ((byte[]) invocation.getArgument(1)).length))
                .thenAnswer(invocation -> new ChatAttachmentStorage.StoredChatAttachment(
                        invocation.getArgument(0),
                        invocation.getArgument(2),
                        ((byte[]) invocation.getArgument(1)).length))
                .thenThrow(new ChatAttachmentStorageException("S3 down"));

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(
                        pngFile("1.png", 64),
                        pngFile("2.png", 64),
                        pngFile("3.png", 64),
                        pngFile("4.png", 64),
                        pngFile("5.png", 64)
                ),
                null
        )).isInstanceOf(ResponseStatusException.class).hasMessageContaining("502");

        verify(messageRepository, never()).saveAndFlush(any());
        verify(attachmentStorage, times(3)).delete(startsWith("chat/conversations/" + conversation.getId()));
        verifyNoInteractions(chatWebSocketHandler);
    }

    @Test
    void dbFailureAfterUploadCleansUpObject() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(accountClient.getIdentity(1L)).thenReturn(studentIdentity(1L));
        when(accountClient.getIdentity(2L)).thenReturn(approvedTutorIdentity(2L));
        when(attachmentStorage.put(any(), any(), any())).thenAnswer(invocation ->
                new ChatAttachmentStorage.StoredChatAttachment(invocation.getArgument(0), invocation.getArgument(2), ((byte[]) invocation.getArgument(1)).length));
        when(messageRepository.saveAndFlush(any(ChatMessage.class))).thenThrow(new DataIntegrityViolationException("db"));

        assertThatThrownBy(() -> chatService.sendAttachment(
                principal(1L, "student@test.com", "STUDENT"),
                conversation.getId(),
                List.of(pngFile("proof.png", 64)),
                null
        ))
                .isInstanceOf(DataIntegrityViolationException.class);

        verify(attachmentStorage).delete(startsWith("chat/conversations/" + conversation.getId()));
        verifyNoInteractions(chatWebSocketHandler);
    }

    @Test
    void nonParticipantCannotReadOrSend() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> chatService.getConversationMessages(conversation.getId(),
                principal(9L, "outsider@test.com", "STUDENT"), 0, 20))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");

        assertThatThrownBy(() -> chatService.sendMessage(principal(9L, "outsider@test.com", "STUDENT"),
                SendMessageRequest.builder().conversationId(conversation.getId()).content("spoof").build()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
        verifyNoInteractions(chatWebSocketHandler);
    }

    @Test
    void blankAndOversizedMessagesAreRejected() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> chatService.sendMessage(principal(1L, "student@test.com", "STUDENT"),
                SendMessageRequest.builder().conversationId(conversation.getId()).content("   ").build()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");

        assertThatThrownBy(() -> chatService.sendMessage(principal(1L, "student@test.com", "STUDENT"),
                SendMessageRequest.builder().conversationId(conversation.getId()).content("x".repeat(3001)).build()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void historyIsPaginatedNewestFirst() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        var message = ChatMessage.builder()
                .id(UUID.randomUUID())
                .conversationId(conversation.getId())
                .senderId(1L)
                .senderEmail("student@test.com")
                .recipientId(2L)
                .recipientEmail("tutor@test.com")
                .type(ChatMessageType.TEXT)
                .content("latest")
                .createdAt(OffsetDateTime.now())
                .build();
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(messageRepository.findByConversationIdOrderByCreatedAtDescIdDesc(eq(conversation.getId()), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(message), PageRequest.of(0, 1), 2));

        var page = chatService.getConversationMessages(conversation.getId(), principal(1L, "student@test.com", "STUDENT"), 0, 1);

        assertThat(page.content()).hasSize(1);
        assertThat(page.totalElements()).isEqualTo(2);
        assertThat(page.order()).isEqualTo("createdAt_desc,id_desc");
    }

    @Test
    void markReadClearsOnlyIncomingUnreadForCurrentUser() {
        var conversation = conversation(1L, "student@test.com", 2L, "tutor@test.com");
        when(conversationRepository.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        when(messageRepository.markMessagesAsReadByRecipientId(conversation.getId(), 2L)).thenReturn(3);
        when(messageRepository.countByConversationIdAndRecipientIdAndIsReadFalse(conversation.getId(), 2L)).thenReturn(0L);

        var response = chatService.markConversationRead(conversation.getId(), principal(2L, "tutor@test.com", "TUTOR"));

        assertThat(response.updatedCount()).isEqualTo(3);
        assertThat(response.unreadCount()).isZero();
        verify(chatNotificationService).markConversationNotificationsRead(2L, conversation.getId().toString());
    }

    private NotificationPrincipal principal(Long userId, String email, String activeRole) {
        return new NotificationPrincipal(userId, email, activeRole, List.of(activeRole));
    }

    private ChatIdentity studentIdentity(Long userId) {
        return new ChatIdentity(userId, "student" + userId + "@test.com", "Student " + userId,
                null, "ACTIVE", List.of("STUDENT"), true, false, false, null);
    }

    private ChatIdentity approvedTutorIdentity(Long userId) {
        return new ChatIdentity(userId, "tutor" + userId + "@test.com", "Tutor " + userId,
                null, "ACTIVE", List.of("TUTOR"), false, true, true, userId + 1000);
    }

    private ChatIdentity unapprovedTutorIdentity(Long userId) {
        return new ChatIdentity(userId, "tutor" + userId + "@test.com", "Tutor " + userId,
                null, "ACTIVE", List.of("TUTOR"), false, true, false, userId + 1000);
    }

    private Conversation conversation(Long p1Id, String p1Email, Long p2Id, String p2Email) {
        Long low = Math.min(p1Id, p2Id);
        Long high = Math.max(p1Id, p2Id);
        return Conversation.builder()
                .id(UUID.randomUUID())
                .participant1Id(p1Id)
                .participant1Email(p1Email)
                .participant2Id(p2Id)
                .participant2Email(p2Email)
                .participantLowUserId(low)
                .participantHighUserId(high)
                .lastMessage("")
                .lastMessageTime(OffsetDateTime.now())
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
    }

    private MockMultipartFile pngFile(String name, int size) {
        byte[] bytes = new byte[Math.max(size, 8)];
        bytes[0] = (byte) 0x89;
        bytes[1] = 0x50;
        bytes[2] = 0x4E;
        bytes[3] = 0x47;
        bytes[4] = 0x0D;
        bytes[5] = 0x0A;
        bytes[6] = 0x1A;
        bytes[7] = 0x0A;
        return new MockMultipartFile("file", name, "image/png", bytes);
    }

    private MockMultipartFile mp4File(String name, int size) {
        byte[] bytes = new byte[Math.max(size, 12)];
        bytes[4] = 'f';
        bytes[5] = 't';
        bytes[6] = 'y';
        bytes[7] = 'p';
        return new MockMultipartFile("file", name, "video/mp4", bytes);
    }
}
