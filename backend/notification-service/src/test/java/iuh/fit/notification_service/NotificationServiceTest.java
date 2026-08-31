package iuh.fit.notification_service;

import iuh.fit.notification_service.dto.NotificationDto;
import iuh.fit.notification_service.dto.SendNotificationRequest;
import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.enums.NotificationStatus;
import iuh.fit.notification_service.enums.NotificationType;
import iuh.fit.notification_service.realtime.NotificationEventHub;
import iuh.fit.notification_service.repository.NotificationRepository;
import iuh.fit.notification_service.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class NotificationServiceTest {

    private NotificationRepository notificationRepository;
    private NotificationEventHub notificationEventHub;
    private iuh.fit.notification_service.service.EmailNotificationService emailNotificationService;
    private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        notificationRepository = mock(NotificationRepository.class);
        notificationEventHub = mock(NotificationEventHub.class);
        emailNotificationService = mock(iuh.fit.notification_service.service.EmailNotificationService.class);
        notificationService = new NotificationService(notificationRepository, notificationEventHub, emailNotificationService);
    }

    @Test
    void createAndSendNotificationSuccess() {
        SendNotificationRequest request = SendNotificationRequest.builder()
                .recipientEmail("student@test.com")
                .recipientId(10L)
                .title("Ký quỹ thành công")
                .content("Học viên đã nạp cọc $100 USDC vào Smart Contract Escrow.")
                .type(NotificationType.AGREEMENT_FUNDED)
                .referenceType("AGREEMENT")
                .referenceId("agr-123")
                .build();

        Notification saved = Notification.builder()
                .id(UUID.randomUUID())
                .recipientEmail(request.getRecipientEmail())
                .recipientId(request.getRecipientId())
                .title(request.getTitle())
                .content(request.getContent())
                .type(request.getType())
                .referenceType(request.getReferenceType())
                .referenceId(request.getReferenceId())
                .status(NotificationStatus.UNREAD)
                .isRead(false)
                .createdAt(OffsetDateTime.now())
                .build();

        when(notificationRepository.save(any(Notification.class))).thenReturn(saved);

        NotificationDto result = notificationService.createAndSendNotification(request);

        assertThat(result.getTitle()).isEqualTo("Ký quỹ thành công");
        assertThat(result.getRecipientEmail()).isEqualTo("student@test.com");
        assertThat(result.getType()).isEqualTo(NotificationType.AGREEMENT_FUNDED);
        assertThat(result.isRead()).isFalse();

        verify(notificationRepository).save(any(Notification.class));
        verify(notificationEventHub).pushNotification(any(NotificationDto.class));
    }

    @Test
    void getUserNotificationsReturnsPage() {
        Notification n = Notification.builder()
                .id(UUID.randomUUID())
                .recipientEmail("student@test.com")
                .title("Test")
                .content("Content")
                .type(NotificationType.SYSTEM_ALERT)
                .status(NotificationStatus.UNREAD)
                .createdAt(OffsetDateTime.now())
                .build();

        when(notificationRepository.findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc(eq("student@test.com"), any()))
                .thenReturn(new PageImpl<>(List.of(n)));

        Page<NotificationDto> page = notificationService.getUserNotifications("student@test.com", PageRequest.of(0, 10));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getTitle()).isEqualTo("Test");
    }

    @Test
    void markAsReadUpdatesStatus() {
        UUID id = UUID.randomUUID();
        Notification n = Notification.builder()
                .id(id)
                .recipientEmail("student@test.com")
                .title("Test")
                .content("Content")
                .type(NotificationType.SYSTEM_ALERT)
                .status(NotificationStatus.UNREAD)
                .isRead(false)
                .createdAt(OffsetDateTime.now())
                .build();

        when(notificationRepository.findById(id)).thenReturn(Optional.of(n));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificationDto result = notificationService.markAsRead(id, "student@test.com");

        assertThat(result.isRead()).isTrue();
        assertThat(result.getStatus()).isEqualTo(NotificationStatus.READ);
    }
}
