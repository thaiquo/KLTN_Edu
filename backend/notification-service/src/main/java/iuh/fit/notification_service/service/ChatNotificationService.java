package iuh.fit.notification_service.service;

import iuh.fit.notification_service.entity.ChatMessage;
import iuh.fit.notification_service.entity.ChatMessageType;
import iuh.fit.notification_service.enums.NotificationType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ChatNotificationService {
    private static final Logger log = LoggerFactory.getLogger(ChatNotificationService.class);

    private static final String REFERENCE_TYPE = "CHAT_CONVERSATION";

    private final ChatViewPresenceService chatViewPresenceService;
    private final NotificationService notificationService;
    private final TransactionTemplate notificationTransaction;

    @Autowired
    public ChatNotificationService(
            ChatViewPresenceService chatViewPresenceService,
            NotificationService notificationService,
            PlatformTransactionManager transactionManager) {
        this.chatViewPresenceService = chatViewPresenceService;
        this.notificationService = notificationService;
        this.notificationTransaction = new TransactionTemplate(transactionManager);
        this.notificationTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public ChatNotificationService(
            ChatViewPresenceService chatViewPresenceService,
            NotificationService notificationService) {
        this.chatViewPresenceService = chatViewPresenceService;
        this.notificationService = notificationService;
        this.notificationTransaction = null;
    }

    public void publishAfterCommit(ChatMessage message, String senderDisplayName, String targetRole) {
        if (message == null || message.getSenderId() == null || message.getRecipientId() == null
                || message.getSenderId().equals(message.getRecipientId())) {
            return;
        }

        Runnable action = () -> createNotification(message, senderDisplayName, targetRole);
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    public int markConversationNotificationsRead(Long recipientUserId, String conversationId) {
        return notificationService.markUnreadChatConversationNotificationsRead(recipientUserId, conversationId);
    }

    private void createNotification(ChatMessage message, String senderDisplayName, String targetRole) {
        try {
            if (chatViewPresenceService.isChatViewActive(message.getRecipientId())) {
                log.debug(
                        "Suppressed chat notification messageId={} recipientUserId={} because chat view is active",
                        message.getId(),
                        message.getRecipientId());
                return;
            }

            NotificationCommand command = new NotificationCommand(
                    "chat-message:" + message.getId(),
                    message.getRecipientId(),
                    NotificationType.CHAT_MESSAGE.name(),
                    "Tin nhắn mới",
                    buildMessage(message, senderDisplayName),
                    normalizeRole(targetRole),
                    REFERENCE_TYPE,
                    String.valueOf(message.getConversationId())
            );
            if (notificationTransaction == null) {
                notificationService.createIfAbsent(command);
            } else {
                notificationTransaction.executeWithoutResult(ignored -> notificationService.createIfAbsent(command));
            }
        } catch (Exception ex) {
            log.warn(
                    "Chat notification creation failed messageId={} recipientUserId={}",
                    message.getId(),
                    message.getRecipientId(),
                    ex);
        }
    }

    private String buildMessage(ChatMessage message, String senderDisplayName) {
        String sender = senderDisplayName == null || senderDisplayName.isBlank()
                ? "Người dùng EduConnect"
                : senderDisplayName.trim();
        ChatMessageType type = message.getType() == null ? ChatMessageType.TEXT : message.getType();
        return switch (type) {
            case IMAGE -> {
                int count = message.getAttachments() == null || message.getAttachments().isEmpty()
                        ? 1
                        : message.getAttachments().size();
                yield count == 1
                        ? sender + " đã gửi hình ảnh"
                        : sender + " đã gửi " + count + " hình ảnh";
            }
            case VIDEO -> sender + " đã gửi một video";
            case TEXT -> sender + " đã gửi cho bạn một tin nhắn";
        };
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        String normalized = role.trim().toUpperCase();
        return normalized.startsWith("ROLE_") ? normalized.substring(5) : normalized;
    }
}

