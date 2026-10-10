package iuh.fit.notification_service.service;

import iuh.fit.notification_service.client.AccountChatIdentityClient;
import iuh.fit.notification_service.client.AccountChatIdentityClient.ChatIdentity;
import iuh.fit.notification_service.client.LearningSharedResourceClient;
import iuh.fit.notification_service.config.security.NotificationPrincipal;
import iuh.fit.notification_service.dto.ChatAttachmentDto;
import iuh.fit.notification_service.dto.ChatMessageDto;
import iuh.fit.notification_service.dto.ChatMessagePageDto;
import iuh.fit.notification_service.dto.ConversationDto;
import iuh.fit.notification_service.dto.MarkReadResponse;
import iuh.fit.notification_service.dto.SendMessageRequest;
import iuh.fit.notification_service.dto.SendSharedResourceRequest;
import iuh.fit.notification_service.dto.StartDirectConversationRequest;
import iuh.fit.notification_service.entity.ChatAttachment;
import iuh.fit.notification_service.entity.ChatMessage;
import iuh.fit.notification_service.entity.ChatMessageType;
import iuh.fit.notification_service.entity.Conversation;
import iuh.fit.notification_service.entity.SharedResourceType;
import iuh.fit.notification_service.realtime.ChatWebSocketHandler;
import iuh.fit.notification_service.repository.ChatMessageRepository;
import iuh.fit.notification_service.repository.ConversationRepository;
import iuh.fit.notification_service.service.storage.ChatAttachmentStorage;
import iuh.fit.notification_service.service.storage.ChatAttachmentStorageException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChatService {
    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final int MAX_MESSAGE_LENGTH = 3000;

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatWebSocketHandler chatWebSocketHandler;
    private final AccountChatIdentityClient accountClient;
    private final ChatAttachmentStorage attachmentStorage;
    private final ChatAttachmentPolicy attachmentPolicy;
    private final ChatNotificationService chatNotificationService;
    private final LearningSharedResourceClient sharedResourceClient;

    public ChatService(ConversationRepository conversationRepository,
                       ChatMessageRepository messageRepository,
                       ChatWebSocketHandler chatWebSocketHandler,
                       AccountChatIdentityClient accountClient,
                       ChatAttachmentStorage attachmentStorage,
                       ChatAttachmentPolicy attachmentPolicy,
                       ChatNotificationService chatNotificationService,
                       LearningSharedResourceClient sharedResourceClient) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.chatWebSocketHandler = chatWebSocketHandler;
        this.accountClient = accountClient;
        this.attachmentStorage = attachmentStorage;
        this.attachmentPolicy = attachmentPolicy;
        this.chatNotificationService = chatNotificationService;
        this.sharedResourceClient = sharedResourceClient;
    }

    @Transactional
    public ConversationDto startDirectConversation(NotificationPrincipal principal, StartDirectConversationRequest request) {
        requirePrincipal(principal);
        if (request == null || request.recipientUserId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient user id is required");
        }
        Conversation conversation = getOrCreateDirectConversation(principal, request.recipientUserId());
        return toConversationDto(conversation, principal.userId());
    }

    @Transactional
    public ChatMessageDto sendMessage(NotificationPrincipal principal, SendMessageRequest request) {
        requirePrincipal(principal);
        String content = normalizeContent(request != null ? request.getContent() : null);
        Conversation conversation;
        if (request != null && request.getConversationId() != null) {
            conversation = conversationRepository.findById(request.getConversationId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        } else {
            Long recipientUserId = resolveRequestedRecipientUserId(request);
            conversation = getOrCreateDirectConversation(principal, recipientUserId);
        }

        requireParticipant(conversation, principal.userId());
        ParticipantContext participantContext = requireCanSend(principal, conversation);
        boolean firstParticipant = principal.userId().equals(conversation.getParticipant1Id());
        String recipientEmail = firstParticipant ? conversation.getParticipant2Email() : conversation.getParticipant1Email();
        Long recipientId = firstParticipant ? conversation.getParticipant2Id() : conversation.getParticipant1Id();
        ChatMessage message = ChatMessage.builder()
                .conversationId(conversation.getId())
                .senderId(principal.userId())
                .senderEmail(principal.email())
                .recipientId(recipientId)
                .recipientEmail(recipientEmail)
                .content(content)
                .isRead(false)
                .build();

        ChatMessage saved = messageRepository.save(message);
        conversation.setLastMessage(previewText(saved));
        conversation.setLastMessageTime(saved.getCreatedAt());
        conversation.setUpdatedAt(OffsetDateTime.now());
        conversationRepository.save(conversation);

        ChatMessageDto dto = toMessageDto(saved);
        chatWebSocketHandler.pushChatMessage(dto);
        publishChatNotificationQuietly(
                saved,
                participantContext.sender().fullName(),
                counterpartRole(participantContext.recipient()));
        return dto;
    }

    @Transactional
    public ChatMessageDto sendSharedResource(
            NotificationPrincipal principal,
            UUID conversationId,
            SendSharedResourceRequest request
    ) {
        requirePrincipal(principal);
        if (request == null || request.resourceType() == null || request.resourcePublicId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thông tin tài nguyên chia sẻ không hợp lệ");
        }
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        requireParticipant(conversation, principal.userId());
        ParticipantContext participantContext = requireCanSend(principal, conversation);
        sharedResourceClient.requireAvailable(request.resourceType(), request.resourcePublicId());

        boolean firstParticipant = principal.userId().equals(conversation.getParticipant1Id());
        ChatMessage message = ChatMessage.builder()
                .conversationId(conversation.getId())
                .senderId(principal.userId())
                .senderEmail(principal.email())
                .recipientId(firstParticipant ? conversation.getParticipant2Id() : conversation.getParticipant1Id())
                .recipientEmail(firstParticipant ? conversation.getParticipant2Email() : conversation.getParticipant1Email())
                .type(ChatMessageType.SHARED_RESOURCE)
                .content(normalizeOptionalCaption(request.caption()))
                .sharedResourceType(request.resourceType())
                .sharedResourcePublicId(request.resourcePublicId())
                .isRead(false)
                .build();

        ChatMessage saved = messageRepository.save(message);
        conversation.setLastMessage(previewText(saved));
        conversation.setLastMessageTime(saved.getCreatedAt());
        conversation.setUpdatedAt(OffsetDateTime.now());
        conversationRepository.save(conversation);

        ChatMessageDto dto = toMessageDto(saved);
        chatWebSocketHandler.pushChatMessage(dto);
        publishChatNotificationQuietly(
                saved,
                participantContext.sender().fullName(),
                counterpartRole(participantContext.recipient()));
        return dto;
    }

    @Transactional
    public ChatMessageDto sendAttachment(NotificationPrincipal principal, UUID conversationId, List<MultipartFile> files, String caption) {
        requirePrincipal(principal);
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        requireParticipant(conversation, principal.userId());
        ParticipantContext participantContext = requireCanSend(principal, conversation);

        ChatAttachmentPolicy.ValidatedAttachmentGroup group = attachmentPolicy.validate(files);
        String normalizedCaption = normalizeOptionalCaption(caption);
        boolean firstParticipant = principal.userId().equals(conversation.getParticipant1Id());
        String recipientEmail = firstParticipant ? conversation.getParticipant2Email() : conversation.getParticipant1Email();
        Long recipientId = firstParticipant ? conversation.getParticipant2Id() : conversation.getParticipant1Id();
        UUID messageId = UUID.randomUUID();
        List<UploadedAttachment> uploaded = new ArrayList<>();

        try {
            for (ChatAttachmentPolicy.ValidatedAttachment attachment : group.attachments()) {
                UUID attachmentId = UUID.randomUUID();
                String objectKey = "chat/conversations/" + conversation.getId()
                        + "/messages/" + messageId
                        + "/" + attachmentId + "-" + attachment.originalFilename();
                attachmentStorage.put(objectKey, attachment.bytes(), attachment.contentType());
                uploaded.add(new UploadedAttachment(attachmentId, objectKey, attachment));
            }

            ChatMessage message = ChatMessage.builder()
                    .id(messageId)
                    .conversationId(conversation.getId())
                    .senderId(principal.userId())
                    .senderEmail(principal.email())
                    .recipientId(recipientId)
                    .recipientEmail(recipientEmail)
                    .type(group.type())
                    .content(normalizedCaption)
                    .isRead(false)
                    .build();
            for (UploadedAttachment item : uploaded) {
                ChatAttachmentPolicy.ValidatedAttachment attachment = item.attachment();
                message.addAttachment(ChatAttachment.builder()
                        .id(item.id())
                        .objectKey(item.objectKey())
                        .originalName(attachment.originalFilename())
                        .contentType(attachment.contentType())
                        .size((long) attachment.bytes().length)
                        .sha256(attachment.sha256())
                        .build());
            }

            ChatMessage saved = messageRepository.saveAndFlush(message);
            conversation.setLastMessage(previewText(saved));
            conversation.setLastMessageTime(saved.getCreatedAt());
            conversation.setUpdatedAt(OffsetDateTime.now());
            conversationRepository.save(conversation);

            ChatMessageDto dto = toMessageDto(saved);
            chatWebSocketHandler.pushChatMessage(dto);
            publishChatNotificationQuietly(
                    saved,
                    participantContext.sender().fullName(),
                    counterpartRole(participantContext.recipient()));
            return dto;
        } catch (ChatAttachmentStorageException ex) {
            deleteAttachmentsQuietly(uploaded.stream().map(UploadedAttachment::objectKey).toList());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Không thể gửi tệp lúc này. Vui lòng thử lại.", ex);
        } catch (RuntimeException ex) {
            deleteAttachmentsQuietly(uploaded.stream().map(UploadedAttachment::objectKey).toList());
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<ConversationDto> getUserConversations(NotificationPrincipal principal) {
        requirePrincipal(principal);
        return conversationRepository.findByParticipantUserId(principal.userId()).stream()
                .map(c -> toConversationDto(c, principal.userId()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChatMessagePageDto getConversationMessages(UUID conversationId, NotificationPrincipal principal, int page, int size) {
        requirePrincipal(principal);
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        requireParticipant(conversation, principal.userId());
        int normalizedPage = Math.max(0, page);
        int normalizedSize = Math.min(Math.max(size, 1), 50);
        Page<ChatMessage> messages = messageRepository.findByConversationIdOrderByCreatedAtDescIdDesc(
                conversationId,
                PageRequest.of(normalizedPage, normalizedSize)
        );
        return ChatMessagePageDto.builder()
                .content(messages.getContent().stream().map(this::toMessageDto).toList())
                .page(messages.getNumber())
                .size(messages.getSize())
                .totalElements(messages.getTotalElements())
                .totalPages(messages.getTotalPages())
                .last(messages.isLast())
                .order("createdAt_desc,id_desc")
                .build();
    }

    @Transactional
    public MarkReadResponse markConversationRead(UUID conversationId, NotificationPrincipal principal) {
        requirePrincipal(principal);
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        requireParticipant(conversation, principal.userId());
        int updated = messageRepository.markMessagesAsReadByRecipientId(conversationId, principal.userId());
        chatNotificationService.markConversationNotificationsRead(
                principal.userId(),
                conversationId.toString());
        long unread = messageRepository.countByConversationIdAndRecipientIdAndIsReadFalse(conversationId, principal.userId());
        return new MarkReadResponse(updated, unread);
    }

    private void requireParticipant(Conversation conversation, Long userId) {
        if (userId == null || (!userId.equals(conversation.getParticipant1Id())
                && !userId.equals(conversation.getParticipant2Id()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conversation belongs to other users");
        }
    }

    private Conversation getOrCreateDirectConversation(NotificationPrincipal principal, Long recipientUserId) {
        if (recipientUserId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient user id is required");
        }
        if (principal.userId().equals(recipientUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot start a conversation with yourself");
        }
        Pair pair = Pair.of(principal.userId(), recipientUserId);
        return conversationRepository.findByParticipantLowUserIdAndParticipantHighUserId(pair.low(), pair.high())
                .map(existing -> {
                    requireCanSend(principal, existing);
                    return existing;
                })
                .orElseGet(() -> createDirectConversation(principal, recipientUserId, pair));
    }

    private Conversation createDirectConversation(NotificationPrincipal principal, Long recipientUserId, Pair pair) {
        ChatIdentity sender = accountClient.getIdentity(principal.userId());
        ChatIdentity recipient = accountClient.getIdentity(recipientUserId);
        validateDirectChatRule(principal, sender, recipient);
        Conversation c = Conversation.builder()
                .participant1Id(sender.userId())
                .participant1Email(sender.email())
                .participant2Id(recipient.userId())
                .participant2Email(recipient.email())
                .participantLowUserId(pair.low())
                .participantHighUserId(pair.high())
                .lastMessage("")
                .lastMessageTime(OffsetDateTime.now())
                .build();
        try {
            return conversationRepository.saveAndFlush(c);
        } catch (DataIntegrityViolationException ex) {
            return conversationRepository.findByParticipantLowUserIdAndParticipantHighUserId(pair.low(), pair.high())
                    .orElseThrow(() -> ex);
        }
    }

    private ParticipantContext requireCanSend(NotificationPrincipal principal, Conversation conversation) {
        Long counterpartId = counterpartUserId(conversation, principal.userId());
        ChatIdentity sender = accountClient.getIdentity(principal.userId());
        ChatIdentity recipient = accountClient.getIdentity(counterpartId);
        validateDirectChatRule(principal, sender, recipient);
        return new ParticipantContext(sender, recipient);
    }

    private void validateDirectChatRule(NotificationPrincipal principal, ChatIdentity sender, ChatIdentity recipient) {
        if (!sender.isActive() || !recipient.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chat participant account is not active");
        }
        String activeRole = normalizeRole(principal.activeRole());
        if ("STUDENT".equals(activeRole)) {
            if (!sender.hasStudentProfile()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student profile is required to start chat");
            }
            if (!recipient.tutorApproved()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Recipient must be an approved Tutor");
            }
            return;
        }
        if ("TUTOR".equals(activeRole)) {
            if (!sender.tutorApproved()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Approved Tutor status is required to chat");
            }
            if (!recipient.hasStudentProfile()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Recipient must be a Student");
            }
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only Student and Tutor direct chat is supported");
    }

    private ConversationDto toConversationDto(Conversation c, Long currentUserId) {
        Long counterpartUserId = counterpartUserId(c, currentUserId);
        String counterpartEmail = counterpartUserId.equals(c.getParticipant1Id()) ? c.getParticipant1Email() : c.getParticipant2Email();
        ChatIdentity counterpart = null;
        try {
            counterpart = accountClient.getIdentity(counterpartUserId);
        } catch (ResponseStatusException ignored) {
            // Existing history remains readable if Account lookup is temporarily unavailable.
        }
        long unread = messageRepository.countByConversationIdAndRecipientIdAndIsReadFalse(c.getId(), currentUserId);
        return ConversationDto.builder()
                .id(c.getId())
                .counterpartUserId(counterpartUserId)
                .counterpartEmail(counterpart != null ? counterpart.email() : counterpartEmail)
                .counterpartDisplayName(counterpart != null ? counterpart.fullName() : counterpartEmail)
                .counterpartAvatarUrl(counterpart != null ? counterpart.avatarUrl() : null)
                .counterpartRole(counterpartRole(counterpart))
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
    }

    private String counterpartRole(ChatIdentity identity) {
        if (identity == null) return null;
        if (identity.tutorApproved()) return "TUTOR";
        if (identity.hasStudentProfile()) return "STUDENT";
        return null;
    }

    private Long counterpartUserId(Conversation c, Long currentUserId) {
        if (currentUserId.equals(c.getParticipant1Id())) return c.getParticipant2Id();
        if (currentUserId.equals(c.getParticipant2Id())) return c.getParticipant1Id();
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conversation belongs to other users");
    }

    private Long resolveRequestedRecipientUserId(SendMessageRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message request is required");
        }
        if (request.getRecipientUserId() != null) {
            return request.getRecipientUserId();
        }
        if (request.getRecipientId() != null) {
            return request.getRecipientId();
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conversation id is required for message send");
    }

    private String normalizeContent(String raw) {
        String content = raw == null ? "" : raw.trim();
        if (content.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message content cannot be blank");
        }
        if (content.length() > MAX_MESSAGE_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message content must be at most 3000 characters");
        }
        return content;
    }

    private String normalizeOptionalCaption(String raw) {
        String content = raw == null ? "" : raw.trim();
        if (content.length() > MAX_MESSAGE_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message content must be at most 3000 characters");
        }
        return content;
    }

    private String normalizeRole(String role) {
        if (role == null) return "";
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        return normalized.startsWith("ROLE_") ? normalized.substring(5) : normalized;
    }

    private void requirePrincipal(NotificationPrincipal principal) {
        if (principal == null || principal.userId() == null || principal.email() == null || principal.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
        }
    }

    private ChatMessageDto toMessageDto(ChatMessage message) {
        List<ChatAttachmentDto> attachments = toAttachmentDtos(message);
        return ChatMessageDto.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .senderId(message.getSenderId())
                .senderEmail(message.getSenderEmail())
                .recipientId(message.getRecipientId())
                .recipientEmail(message.getRecipientEmail())
                .type((message.getType() == null ? ChatMessageType.TEXT : message.getType()).name())
                .content(message.getContent())
                .sharedResourceType(message.getSharedResourceType() != null ? message.getSharedResourceType().name() : null)
                .sharedResourcePublicId(message.getSharedResourcePublicId())
                .attachments(attachments)
                .isRead(message.isRead())
                .createdAt(message.getCreatedAt())
                .build();
    }

    private List<ChatAttachmentDto> toAttachmentDtos(ChatMessage message) {
        ChatMessageType type = message.getType() == null ? ChatMessageType.TEXT : message.getType();
        if (type == ChatMessageType.TEXT || type == ChatMessageType.SHARED_RESOURCE) {
            return List.of();
        }
        if (message.getAttachments() != null && !message.getAttachments().isEmpty()) {
            return message.getAttachments().stream()
                    .map(this::toAttachmentDto)
                    .toList();
        }
        return List.of();
    }

    private ChatAttachmentDto toAttachmentDto(ChatAttachment attachment) {
        String url = null;
        try {
            url = attachmentStorage.createPresignedGetUrl(attachment.getObjectKey());
        } catch (ChatAttachmentStorageException ignored) {
            // History remains readable; the client can retry later for a fresh media URL.
        }
        return ChatAttachmentDto.builder()
                .id(attachment.getId())
                .fileName(attachment.getOriginalName())
                .contentType(attachment.getContentType())
                .size(attachment.getSize())
                .url(url)
                .build();
    }

    private String previewText(ChatMessage message) {
        ChatMessageType type = message.getType() == null ? ChatMessageType.TEXT : message.getType();
        return switch (type) {
            case IMAGE -> imagePreviewText(message);
            case VIDEO -> "Đã gửi một video";
            case SHARED_RESOURCE -> message.getSharedResourceType() == SharedResourceType.CLASS
                    ? "Đã chia sẻ một lớp học"
                    : "Đã chia sẻ một bài viết";
            case TEXT -> message.getContent();
        };
    }

    private String imagePreviewText(ChatMessage message) {
        int count = message.getAttachments() == null || message.getAttachments().isEmpty()
                ? 1
                : message.getAttachments().size();
        return count == 1 ? "Đã gửi 1 hình ảnh" : "Đã gửi " + count + " hình ảnh";
    }

    private void deleteAttachmentsQuietly(List<String> objectKeys) {
        for (String objectKey : objectKeys) {
            try {
                attachmentStorage.delete(objectKey);
            } catch (RuntimeException ignored) {
                // The failed DB transaction remains authoritative; orphan cleanup can be audited separately.
            }
        }
    }

    private record UploadedAttachment(
            UUID id,
            String objectKey,
            ChatAttachmentPolicy.ValidatedAttachment attachment
    ) {}

    private void publishChatNotificationQuietly(
            ChatMessage message,
            String senderDisplayName,
            String targetRole) {
        try {
            chatNotificationService.publishAfterCommit(message, senderDisplayName, targetRole);
        } catch (RuntimeException ex) {
            log.warn(
                    "Chat notification scheduling failed messageId={} recipientUserId={}",
                    message != null ? message.getId() : null,
                    message != null ? message.getRecipientId() : null,
                    ex);
        }
    }

    private record ParticipantContext(
            ChatIdentity sender,
            ChatIdentity recipient
    ) {}

    private record Pair(Long low, Long high) {
        static Pair of(Long first, Long second) {
            return new Pair(Math.min(first, second), Math.max(first, second));
        }
    }
}
