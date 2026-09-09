package iuh.fit.notification_service;

import iuh.fit.notification_service.repository.NotificationRepository;
import iuh.fit.notification_service.service.NotificationCommand;
import iuh.fit.notification_service.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class NotificationServiceTests {
    @Autowired
    private NotificationService notificationService;

    @Autowired
    private NotificationRepository notificationRepository;

    @BeforeEach
    void cleanDatabase() {
        notificationRepository.deleteAll();
    }

    @Test
    void createNotificationDeduplicatesByEventIdAndRecipient() {
        var command = command("evt-1", 11L);

        var first = notificationService.createIfAbsent(command);
        var second = notificationService.createIfAbsent(command);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(notificationRepository.count()).isEqualTo(1);
    }

    @Test
    void sameEventIdCanCreateNotificationsForDifferentRecipients() {
        notificationService.createIfAbsent(command("evt-2", 11L));
        notificationService.createIfAbsent(command("evt-2", 12L));

        assertThat(notificationRepository.count()).isEqualTo(2);
    }

    @Test
    void listUsesCurrentUserAndNewestFirst() {
        var oldNotification = notificationService.createIfAbsent(command("evt-3", 21L));
        var newestNotification = notificationService.createIfAbsent(command("evt-4", 21L));
        notificationService.createIfAbsent(command("evt-5", 22L));

        var response = notificationService.list(21L, 0, 20, false, null);

        assertThat(response.totalElements()).isEqualTo(2);
        assertThat(response.content()).extracting("id")
                .containsExactly(newestNotification.getId(), oldNotification.getId());
    }

    @Test
    void unreadCountMarkReadAndMarkAllReadAreIdempotent() {
        var first = notificationService.createIfAbsent(command("evt-6", 31L));
        notificationService.createIfAbsent(command("evt-7", 31L));

        assertThat(notificationService.unreadCount(31L, null).count()).isEqualTo(2);
        assertThat(notificationService.unreadCount(31L, "TUTOR").count()).isEqualTo(2);
        assertThat(notificationService.unreadCount(31L, "STUDENT").count()).isZero();

        notificationService.markRead(31L, first.getId());
        notificationService.markRead(31L, first.getId());

        assertThat(notificationService.unreadCount(31L, null).count()).isEqualTo(1);
        assertThat(notificationService.markAllRead(31L, "STUDENT").count()).isZero();
        assertThat(notificationService.markAllRead(31L, "TUTOR").count()).isEqualTo(1);
        assertThat(notificationService.markAllRead(31L, null).count()).isZero();
        assertThat(notificationService.unreadCount(31L, null).count()).isZero();
    }

    @Test
    void markReadDeniesOtherUsersNotification() {
        var notification = notificationService.createIfAbsent(command("evt-8", 41L));

        assertThatThrownBy(() -> notificationService.markRead(42L, notification.getId()))
                .isInstanceOf(AccessDeniedException.class);
    }

    private NotificationCommand command(String eventId, Long recipientUserId) {
        return new NotificationCommand(
                eventId,
                recipientUserId,
                "TUTOR_APPLICATION_REVIEWED",
                "Title",
                "Message",
                "TUTOR",
                "TUTOR_APPLICATION",
                "99"
        );
    }
}
