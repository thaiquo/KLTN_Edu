package iuh.fit.notification_service.messaging;

import iuh.fit.notification_service.messaging.event.ClassReviewedNotificationEvent;
import iuh.fit.notification_service.messaging.event.ClassSubmittedNotificationEvent;
import iuh.fit.notification_service.messaging.event.SubjectRequestSubmittedEvent;
import iuh.fit.notification_service.messaging.event.TeachingRegistrationReviewedEvent;
import iuh.fit.notification_service.messaging.event.TeachingRegistrationSubmittedEvent;
import iuh.fit.notification_service.messaging.event.TutorApplicationSubmittedEvent;
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
    void onTutorApplicationSubmittedCreatesStaffNotification() {
        NotificationService notificationService = mock(NotificationService.class);
        NotificationEventConsumer consumer = new NotificationEventConsumer(notificationService);
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);

        consumer.onTutorApplicationSubmitted(new TutorApplicationSubmittedEvent(
                "submitted-1",
                22L,
                33L,
                44L,
                LocalDateTime.now()));

        verify(notificationService).createIfAbsent(captor.capture());

        NotificationCommand command = captor.getValue();
        assertThat(command.eventId()).isEqualTo("submitted-1");
        assertThat(command.recipientUserId()).isEqualTo(44L);
        assertThat(command.type()).isEqualTo("TUTOR_APPLICATION_SUBMITTED");
        assertThat(command.targetRole()).isEqualTo("STAFF");
        assertThat(command.referenceType()).isEqualTo("TUTOR_APPLICATION");
        assertThat(command.referenceId()).isEqualTo("22");
    }

    @Test
    void onSubmittedEventsCreateStaffNotifications() {
        NotificationService notificationService = mock(NotificationService.class);
        NotificationEventConsumer consumer = new NotificationEventConsumer(notificationService);
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);

        consumer.onTeachingRegistrationSubmitted(new TeachingRegistrationSubmittedEvent(
                "teaching-submitted-1",
                "TEACHING_REGISTRATION_SUBMITTED",
                LocalDateTime.now(),
                "learning-service",
                55L,
                900L,
                "tutor@example.com",
                66L,
                "Math",
                "TEACHING_REGISTRATION",
                "55"));
        consumer.onSubjectRequestSubmitted(new SubjectRequestSubmittedEvent(
                "subject-submitted-1",
                "SUBJECT_REQUEST_SUBMITTED",
                LocalDateTime.now(),
                "learning-service",
                77L,
                901L,
                101L,
                "Physics",
                "SUBJECT_REQUEST",
                "77"));
        consumer.onClassSubmitted(new ClassSubmittedNotificationEvent(
                "class-submitted-1",
                "CLASS_SUBMITTED",
                LocalDateTime.now(),
                "learning-service",
                88L,
                902L,
                "tutor@example.com",
                "Physics 10",
                "CLASS",
                "88"));

        verify(notificationService, org.mockito.Mockito.times(3)).createIfAbsent(captor.capture());

        assertThat(captor.getAllValues())
                .extracting(NotificationCommand::type)
                .containsExactly(
                        "TEACHING_REGISTRATION_SUBMITTED",
                        "SUBJECT_REQUEST_SUBMITTED",
                        "CLASS_SUBMITTED");
        assertThat(captor.getAllValues())
                .extracting(NotificationCommand::targetRole)
                .containsOnly("STAFF");
        assertThat(captor.getAllValues())
                .extracting(NotificationCommand::referenceType)
                .containsExactly("TEACHING_REGISTRATION", "SUBJECT_REQUEST", "CLASS");
    }

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
