package iuh.fit.notification_service.service;

import iuh.fit.notification_service.dto.NotificationDtos.MarkAllReadResponse;
import iuh.fit.notification_service.dto.NotificationDtos.NotificationPageResponse;
import iuh.fit.notification_service.dto.NotificationDtos.NotificationResponse;
import iuh.fit.notification_service.dto.NotificationDtos.UnreadCountResponse;
import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.exception.ResourceNotFoundException;
import iuh.fit.notification_service.repository.NotificationRepository;
import iuh.fit.notification_service.realtime.NotificationRealtimePublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final int MAX_PAGE_SIZE = 100;

    private final NotificationRepository notificationRepository;
    private final NotificationRealtimePublisher realtimePublisher;

    public NotificationService(
            NotificationRepository notificationRepository,
            NotificationRealtimePublisher realtimePublisher
    ) {
        this.notificationRepository = notificationRepository;
        this.realtimePublisher = realtimePublisher;
    }

    @Transactional
    public Notification createIfAbsent(NotificationCommand command) {
        validate(command);
        return notificationRepository
                .findByEventIdAndRecipientUserId(command.eventId(), command.recipientUserId())
                .orElseGet(() -> insert(command));
    }

    @Transactional(readOnly = true)
    public NotificationPageResponse list(Long userId, int page, int size, boolean unreadOnly, String targetRole) {
        var pageable = PageRequest.of(
                Math.max(page, 0),
                normalizeSize(size),
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"))
        );
        String normalizedRole = normalizeNullable(targetRole);
        Page<Notification> notifications;
        if (StringUtils.hasText(normalizedRole) && unreadOnly) {
            notifications = notificationRepository.findByRecipientUserIdAndTargetRoleIgnoreCaseAndReadAtIsNull(
                    userId,
                    normalizedRole,
                    pageable
            );
        } else if (StringUtils.hasText(normalizedRole)) {
            notifications = notificationRepository.findByRecipientUserIdAndTargetRoleIgnoreCase(userId, normalizedRole, pageable);
        } else if (unreadOnly) {
            notifications = notificationRepository.findByRecipientUserIdAndReadAtIsNull(userId, pageable);
        } else {
            notifications = notificationRepository.findByRecipientUserId(userId, pageable);
        }

        return new NotificationPageResponse(
                notifications.getContent().stream().map(this::toResponse).toList(),
                notifications.getTotalElements(),
                notifications.getTotalPages(),
                notifications.getNumber(),
                notifications.getSize()
        );
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse unreadCount(Long userId, String targetRole) {
        String normalizedRole = normalizeNullable(targetRole);
        long count = StringUtils.hasText(normalizedRole)
                ? notificationRepository.countByRecipientUserIdAndTargetRoleIgnoreCaseAndReadAtIsNull(userId, normalizedRole)
                : notificationRepository.countByRecipientUserIdAndReadAtIsNull(userId);
        return new UnreadCountResponse(count);
    }

    @Transactional
    public NotificationResponse markRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        ensureOwner(userId, notification);
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
        }
        return toResponse(notification);
    }

    @Transactional
    public MarkAllReadResponse markAllRead(Long userId, String targetRole) {
        String normalizedRole = normalizeNullable(targetRole);
        int count = StringUtils.hasText(normalizedRole)
                ? notificationRepository.markAllUnreadAsReadForTargetRole(userId, normalizedRole, LocalDateTime.now())
                : notificationRepository.markAllUnreadAsRead(userId, LocalDateTime.now());
        return new MarkAllReadResponse(count);
    }

    private Notification insert(NotificationCommand command) {
        try {
            Notification notification = new Notification();
            notification.setEventId(command.eventId().trim());
            notification.setRecipientUserId(command.recipientUserId());
            notification.setType(command.type().trim());
            notification.setTitle(command.title().trim());
            notification.setMessage(command.message().trim());
            notification.setTargetRole(normalizeNullable(command.targetRole()));
            notification.setReferenceType(normalizeNullable(command.referenceType()));
            notification.setReferenceId(normalizeNullable(command.referenceId()));
            Notification saved = notificationRepository.saveAndFlush(notification);
            log.info("Created notification eventId={} type={} recipientUserId={}",
                    saved.getEventId(), saved.getType(), saved.getRecipientUserId());
            realtimePublisher.publishCreated(saved);
            return saved;
        } catch (DataIntegrityViolationException ex) {
            log.info("Skipped duplicate notification eventId={} recipientUserId={}",
                    command.eventId(), command.recipientUserId());
            return notificationRepository
                    .findByEventIdAndRecipientUserId(command.eventId(), command.recipientUserId())
                    .orElseThrow(() -> ex);
        }
    }

    private void validate(NotificationCommand command) {
        if (command == null) {
            throw new IllegalArgumentException("Notification command is required");
        }
        if (!StringUtils.hasText(command.eventId())) {
            throw new IllegalArgumentException("Notification eventId is required");
        }
        if (command.recipientUserId() == null) {
            throw new IllegalArgumentException("Notification recipientUserId is required");
        }
        if (!StringUtils.hasText(command.type())) {
            throw new IllegalArgumentException("Notification type is required");
        }
        if (!StringUtils.hasText(command.title())) {
            throw new IllegalArgumentException("Notification title is required");
        }
        if (!StringUtils.hasText(command.message())) {
            throw new IllegalArgumentException("Notification message is required");
        }
    }

    private void ensureOwner(Long userId, Notification notification) {
        if (!notification.getRecipientUserId().equals(userId)) {
            throw new AccessDeniedException("You do not have access to this notification");
        }
    }

    private int normalizeSize(int size) {
        if (size <= 0) {
            return 20;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }

    private String normalizeNullable(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getReferenceType(),
                notification.getReferenceId(),
                notification.getTargetRole(),
                notification.getReadAt() != null,
                notification.getReadAt(),
                notification.getCreatedAt()
        );
    }
}
