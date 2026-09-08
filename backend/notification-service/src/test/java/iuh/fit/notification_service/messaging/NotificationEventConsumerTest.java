package iuh.fit.notification_service.messaging;

import iuh.fit.notification_service.messaging.event.ClassReviewedNotificationEvent;
import iuh.fit.notification_service.messaging.event.TeachingRegistrationReviewedEvent;
import iuh.fit.notification_service.service.NotificationCommand;
import iuh.fit.notification_service.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class NotificationEventConsumerTest {

    @Test
    void onClassReviewedCreatesTutorNotification() {
        NotificationService notificationService = mock(NotificationService.class);
        NotificationEventConsumer consumer = new NotificationEventConsumer(notificationService);
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);

        consumer.onClassReviewed(new ClassReviewedNotificationEvent(
                "evt-1",
                "CLASS_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                22L,
                33L,
                "tutor@example.com",
                "Math 10",
                "APPROVED",
                null,
                "staff@example.com"));

        verify(notificationService).createIfAbsent(captor.capture());

        NotificationCommand command = captor.getValue();
        assertThat(command.eventId()).isEqualTo("evt-1");
        assertThat(command.recipientUserId()).isEqualTo(33L);
        assertThat(command.type()).isEqualTo("CLASS_REVIEWED");
        assertThat(command.targetRole()).isEqualTo("TUTOR");
        assertThat(command.referenceType()).isEqualTo("CLASS");
        assertThat(command.referenceId()).isEqualTo("22");
    }

    @Test
    void onClassReviewedCreatesRejectedTutorNotificationWithReason() {
        NotificationService notificationService = mock(NotificationService.class);
        NotificationEventConsumer consumer = new NotificationEventConsumer(notificationService);
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);

        consumer.onClassReviewed(new ClassReviewedNotificationEvent(
                "evt-2",
                "CLASS_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                22L,
                33L,
                "tutor@example.com",
                "Math 10",
                "REJECTED",
                "Need clearer syllabus",
                "staff@example.com"));

        verify(notificationService).createIfAbsent(captor.capture());

        NotificationCommand command = captor.getValue();
        assertThat(command.eventId()).isEqualTo("evt-2");
        assertThat(command.recipientUserId()).isEqualTo(33L);
        assertThat(command.type()).isEqualTo("CLASS_REVIEWED");
        assertThat(command.title()).isEqualTo("Lớp học chưa được duyệt");
        assertThat(command.message()).contains("Need clearer syllabus");
        assertThat(command.targetRole()).isEqualTo("TUTOR");
        assertThat(command.referenceType()).isEqualTo("CLASS");
        assertThat(command.referenceId()).isEqualTo("22");
    }

    @Test
    void onClassReviewedSkipsUnsupportedStatus() {
        NotificationService notificationService = mock(NotificationService.class);
        NotificationEventConsumer consumer = new NotificationEventConsumer(notificationService);

        consumer.onClassReviewed(new ClassReviewedNotificationEvent(
                "evt-1",
                "CLASS_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                22L,
                33L,
                "tutor@example.com",
                "Math 10",
                "PENDING",
                null,
                "staff@example.com"));

        verify(notificationService, never()).createIfAbsent(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void onTeachingRegistrationReviewedCreatesTutorNotification() {
        NotificationService notificationService = mock(NotificationService.class);
        NotificationEventConsumer consumer = new NotificationEventConsumer(notificationService);
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);

        consumer.onTeachingRegistrationReviewed(new TeachingRegistrationReviewedEvent(
                "evt-teaching-1",
                "TEACHING_REGISTRATION_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                44L,
                55L,
                "tutor@example.com",
                66L,
                null,
                "staff@example.com",
                77L,
                "Math",
                "APPROVED",
                null,
                "TEACHING_REGISTRATION",
                "44"));

        verify(notificationService).createIfAbsent(captor.capture());

        NotificationCommand command = captor.getValue();
        assertThat(command.eventId()).isEqualTo("evt-teaching-1");
        assertThat(command.recipientUserId()).isEqualTo(55L);
        assertThat(command.type()).isEqualTo("TEACHING_REGISTRATION_REVIEWED");
        assertThat(command.title()).isEqualTo("Đăng ký môn học đã được phê duyệt");
        assertThat(command.targetRole()).isEqualTo("TUTOR");
        assertThat(command.referenceType()).isEqualTo("TEACHING_REGISTRATION");
        assertThat(command.referenceId()).isEqualTo("44");
    }

    @Test
    void onTeachingRegistrationReviewedCreatesRejectedTutorNotificationWithReason() {
        NotificationService notificationService = mock(NotificationService.class);
        NotificationEventConsumer consumer = new NotificationEventConsumer(notificationService);
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);

        consumer.onTeachingRegistrationReviewed(new TeachingRegistrationReviewedEvent(
                "evt-teaching-2",
                "TEACHING_REGISTRATION_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                44L,
                55L,
                "tutor@example.com",
                66L,
                null,
                "staff@example.com",
                77L,
                "Math",
                "REJECTED",
                "Need certificate",
                "TEACHING_REGISTRATION",
                "44"));

        verify(notificationService).createIfAbsent(captor.capture());

        NotificationCommand command = captor.getValue();
        assertThat(command.type()).isEqualTo("TEACHING_REGISTRATION_REVIEWED");
        assertThat(command.title()).isEqualTo("Đăng ký môn học đã bị từ chối");
        assertThat(command.message()).contains("Need certificate");
        assertThat(command.targetRole()).isEqualTo("TUTOR");
        assertThat(command.referenceType()).isEqualTo("TEACHING_REGISTRATION");
        assertThat(command.referenceId()).isEqualTo("44");
    }

    @Test
    void onTeachingRegistrationReviewedSkipsUnsupportedStatus() {
        NotificationService notificationService = mock(NotificationService.class);
        NotificationEventConsumer consumer = new NotificationEventConsumer(notificationService);

        consumer.onTeachingRegistrationReviewed(new TeachingRegistrationReviewedEvent(
                "evt-teaching-3",
                "TEACHING_REGISTRATION_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                44L,
                55L,
                "tutor@example.com",
                66L,
                null,
                "staff@example.com",
                77L,
                "Math",
                "PENDING",
                null,
                "TEACHING_REGISTRATION",
                "44"));

        verify(notificationService, never()).createIfAbsent(org.mockito.ArgumentMatchers.any());
    }
}
