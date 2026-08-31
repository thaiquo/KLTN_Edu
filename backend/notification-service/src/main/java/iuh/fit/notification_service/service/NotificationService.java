package iuh.fit.notification_service.service;

import iuh.fit.notification_service.dto.NotificationDto;
import iuh.fit.notification_service.dto.SendNotificationRequest;
import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.enums.NotificationStatus;
import iuh.fit.notification_service.realtime.NotificationEventHub;
import iuh.fit.notification_service.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationEventHub notificationEventHub;
    private final EmailNotificationService emailNotificationService;

    public NotificationService(
            NotificationRepository notificationRepository,
            NotificationEventHub notificationEventHub,
            EmailNotificationService emailNotificationService) {
        this.notificationRepository = notificationRepository;
        this.notificationEventHub = notificationEventHub;
        this.emailNotificationService = emailNotificationService;
    }

    @Transactional
    public NotificationDto createAndSendNotification(SendNotificationRequest request) {
        Notification notification = Notification.builder()
                .recipientEmail(request.getRecipientEmail().trim())
                .recipientId(request.getRecipientId())
                .title(request.getTitle().trim())
                .content(request.getContent().trim())
                .type(request.getType())
                .referenceType(request.getReferenceType())
                .referenceId(request.getReferenceId())
                .metadataJson(request.getMetadataJson())
                .status(NotificationStatus.UNREAD)
                .isRead(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        NotificationDto dto = toDto(saved);

        // Push real-time to user session via WebSocket
        notificationEventHub.pushNotification(dto);

        // Send email notification asynchronously
        emailNotificationService.sendNotificationEmailAsync(
                saved.getRecipientEmail(),
                saved.getTitle(),
                saved.getContent(),
                saved.getType() != null ? saved.getType().name() : "",
                saved.getReferenceId()
        );

        return dto;
    }

    @Transactional(readOnly = true)
    public Page<NotificationDto> getUserNotifications(String userEmail, Pageable pageable) {
        return notificationRepository.findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc(userEmail.trim(), pageable)
                .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(String userEmail) {
        return notificationRepository.countByRecipientEmailIgnoreCaseAndIsReadFalse(userEmail.trim());
    }

    @Transactional
    public NotificationDto markAsRead(UUID notificationId, String userEmail) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found: " + notificationId));

        if (!notification.getRecipientEmail().equalsIgnoreCase(userEmail.trim())) {
            throw new IllegalArgumentException("Unauthorized to access this notification");
        }

        notification.setRead(true);
        notification.setStatus(NotificationStatus.READ);
        notification.setReadAt(OffsetDateTime.now());

        Notification saved = notificationRepository.save(notification);
        return toDto(saved);
    }

    @Transactional
    public int markAllAsRead(String userEmail) {
        return notificationRepository.markAllAsReadForEmail(userEmail.trim(), OffsetDateTime.now());
    }

    private NotificationDto toDto(Notification entity) {
        return NotificationDto.builder()
                .id(entity.getId())
                .recipientEmail(entity.getRecipientEmail())
                .recipientId(entity.getRecipientId())
                .title(entity.getTitle())
                .content(entity.getContent())
                .type(entity.getType())
                .referenceType(entity.getReferenceType())
                .referenceId(entity.getReferenceId())
                .status(entity.getStatus())
                .isRead(entity.isRead())
                .createdAt(entity.getCreatedAt())
                .readAt(entity.getReadAt())
                .metadataJson(entity.getMetadataJson())
                .build();
    }
}
