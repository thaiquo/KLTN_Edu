package iuh.fit.notification_service;

import iuh.fit.notification_service.dto.NotificationDtos.NotificationPageResponse;
import iuh.fit.notification_service.dto.NotificationDtos.NotificationResponse;
import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.realtime.NotificationRealtimePublisher;
import iuh.fit.notification_service.repository.NotificationRepository;
import iuh.fit.notification_service.service.NotificationCommand;
import iuh.fit.notification_service.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class NotificationServiceTest {

    private NotificationRepository notificationRepository;
    private NotificationRealtimePublisher realtimePublisher;
    private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        notificationRepository = mock(NotificationRepository.class);
        realtimePublisher = mock(NotificationRealtimePublisher.class);

        notificationService = new NotificationService(
                notificationRepository,
                realtimePublisher);
    }

    @Test
    void createIfAbsentCreatesNotification() {
        NotificationCommand command = new NotificationCommand(
                "event-001",
                10L,
                "AGREEMENT_FUNDED",
                "Ký quỹ thành công",
                "Học viên đã nạp cọc thành công.",
                "STUDENT",
                "AGREEMENT",
                "agr-123");

        Notification saved = createNotification(
                1L,
                "event-001",
                10L,
                "AGREEMENT_FUNDED",
                "Ký quỹ thành công",
                "Học viên đã nạp cọc thành công.",
                "STUDENT",
                "AGREEMENT",
                "agr-123");

        when(notificationRepository.findByEventIdAndRecipientUserId(
                "event-001",
                10L)).thenReturn(Optional.empty());

        when(notificationRepository.saveAndFlush(any(Notification.class)))
                .thenReturn(saved);

        Notification result = notificationService.createIfAbsent(command);

        // assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getEventId()).isEqualTo("event-001");
        assertThat(result.getRecipientUserId()).isEqualTo(10L);
        assertThat(result.getType()).isEqualTo("AGREEMENT_FUNDED");
        assertThat(result.getTitle()).isEqualTo("Ký quỹ thành công");

        verify(notificationRepository)
                .saveAndFlush(any(Notification.class));

        verify(realtimePublisher)
                .publishCreated(saved);
    }

    @Test
    void createIfAbsentReturnsExistingNotification() {
        Notification existing = createNotification(
                1L,
                "event-001",
                10L,
                "SYSTEM_ALERT",
                "Thông báo",
                "Nội dung thông báo",
                "STUDENT",
                null,
                null);

        when(notificationRepository.findByEventIdAndRecipientUserId(
                "event-001",
                10L)).thenReturn(Optional.of(existing));

        NotificationCommand command = new NotificationCommand(
                "event-001",
                10L,
                "SYSTEM_ALERT",
                "Thông báo",
                "Nội dung thông báo",
                "STUDENT",
                null,
                null);

        Notification result = notificationService.createIfAbsent(command);

        assertThat(result).isSameAs(existing);

        verify(notificationRepository, never())
                .saveAndFlush(any(Notification.class));

        verifyNoInteractions(realtimePublisher);
    }

    @Test
    void listReturnsNotificationPage() {
        Notification notification = createNotification(
                1L,
                "event-001",
                10L,
                "SYSTEM_ALERT",
                "Thông báo",
                "Nội dung",
                "STUDENT",
                null,
                null);

        when(notificationRepository.findByRecipientUserId(
                eq(10L),
                any(Pageable.class))).thenReturn(new PageImpl<>(List.of(notification)));

        NotificationPageResponse result = notificationService.list(
                10L,
                0,
                20,
                false,
                null);

        assertThat(result.totalElements()).isEqualTo(1);
        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).title())
                .isEqualTo("Thông báo");
    }

    @Test
    void markReadSetsReadAt() {
        Notification notification = createNotification(
                1L,
                "event-001",
                10L,
                "SYSTEM_ALERT",
                "Thông báo",
                "Nội dung",
                "STUDENT",
                null,
                null);

        assertThat(notification.getReadAt()).isNull();

        when(notificationRepository.findById(1L))
                .thenReturn(Optional.of(notification));

        NotificationResponse result = notificationService.markRead(10L, 1L);

        assertThat(notification.getReadAt()).isNotNull();
        assertThat(result.read()).isTrue();
    }

    private Notification createNotification(
            Long id,
            String eventId,
            Long recipientUserId,
            String type,
            String title,
            String message,
            String targetRole,
            String referenceType,
            String referenceId) {
        Notification notification = new Notification();

        /*
         * Entity hiện tại không có setId(),
         * nên id không cần thiết cho phần lớn test.
         * Nếu test markRead cần ID, repository.findById()
         * vẫn được mock độc lập.
         */
        notification.setEventId(eventId);
        notification.setRecipientUserId(recipientUserId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setTargetRole(targetRole);
        notification.setReferenceType(referenceType);
        notification.setReferenceId(referenceId);
        notification.setCreatedAt(LocalDateTime.now());

        return notification;
    }
}