package iuh.fit.notification_service;

import iuh.fit.notification_service.messaging.NotificationEventConsumer;
import iuh.fit.notification_service.messaging.event.SubjectRequestApprovedEvent;
import iuh.fit.notification_service.messaging.event.SubjectRequestRejectedEvent;
import iuh.fit.notification_service.messaging.event.EnrollmentNotificationEvent;
import iuh.fit.notification_service.messaging.event.TutorApplicationSubmittedEvent;
import iuh.fit.notification_service.messaging.event.TutorApprovedEvent;
import iuh.fit.notification_service.messaging.event.TutorRejectedEvent;
import iuh.fit.notification_service.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class NotificationEventConsumerTests {
    @Autowired
    private NotificationEventConsumer consumer;

    @Autowired
    private NotificationRepository notificationRepository;

    @BeforeEach
    void cleanDatabase() {
        notificationRepository.deleteAll();
    }

    @Test
    void tutorApprovedCreatesNotificationAndDeduplicatesRedelivery() {
        var event = new TutorApprovedEvent("approved-1", 101L, 202L, 303L, Set.of(), LocalDateTime.now());

        consumer.onTutorApproved(event);
        consumer.onTutorApproved(event);

        var notifications = notificationRepository.findAll();
        assertThat(notifications).hasSize(1);
        assertThat(notifications.getFirst().getType()).isEqualTo("TUTOR_APPLICATION_REVIEWED");
        assertThat(notifications.getFirst().getRecipientUserId()).isEqualTo(303L);
        assertThat(notifications.getFirst().getTargetRole()).isEqualTo("TUTOR");
    }

    @Test
    void tutorRejectedIncludesSafeReason() {
        consumer.onTutorRejected(new TutorRejectedEvent("rejected-1", 111L, 333L, "Thieu giay to", LocalDateTime.now()));

        assertThat(notificationRepository.findByEventIdAndRecipientUserId("rejected-1", 333L))
                .get()
                .extracting("message")
                .asString()
                .contains("Lý do");
    }

    @Test
    void subjectRequestReviewedCreatesTutorNotification() {
        consumer.onSubjectRequestApproved(new SubjectRequestApprovedEvent("subject-approved-1", 10L, 20L, 30L, LocalDateTime.now()));
        consumer.onSubjectRequestRejected(new SubjectRequestRejectedEvent("subject-rejected-1", 11L, 20L, "Trung danh muc", LocalDateTime.now()));

        assertThat(notificationRepository.findAll()).hasSize(2);
        assertThat(notificationRepository.findByEventIdAndRecipientUserId("subject-approved-1", 20L))
                .get()
                .extracting("referenceType")
                .isEqualTo("SUBJECT_REQUEST");
    }

    @Test
    void invalidOrReviewerOnlyEventsDoNotCreateNotification() {
        consumer.onTutorApplicationSubmitted(new TutorApplicationSubmittedEvent("submitted-1", 1L, 2L, LocalDateTime.now()));
        consumer.onTutorApproved(new TutorApprovedEvent(null, 101L, 202L, 303L, Set.of(), LocalDateTime.now()));
        consumer.onSubjectRequestApproved(new SubjectRequestApprovedEvent("invalid-subject", 10L, null, 30L, LocalDateTime.now()));
        consumer.onEnrollmentRequested(enrollmentEvent("invalid-enrollment", "ENROLLMENT_REQUESTED", null, 100L, null));

        assertThat(notificationRepository.count()).isZero();
    }

    @Test
    void enrollmentRequestedCreatesTutorNotificationAndDeduplicates() {
        var event = enrollmentEvent("enrollment-requested-1", "ENROLLMENT_REQUESTED", 200L, 100L, null);

        consumer.onEnrollmentRequested(event);
        consumer.onEnrollmentRequested(event);

        var notification = notificationRepository.findByEventIdAndRecipientUserId("enrollment-requested-1", 200L);
        assertThat(notification).isPresent();
        assertThat(notification.get().getType()).isEqualTo("ENROLLMENT_REQUESTED");
        assertThat(notification.get().getTargetRole()).isEqualTo("TUTOR");
        assertThat(notification.get().getReferenceType()).isEqualTo("ENROLLMENT_REQUEST");
        assertThat(notification.get().getReferenceId()).isEqualTo("500");
        assertThat(notification.get().getTitle()).isEqualTo("Có yêu cầu tham gia lớp mới");
        assertThat(notificationRepository.count()).isEqualTo(1);
    }

    @Test
    void enrollmentAcceptedCreatesStudentNotification() {
        consumer.onEnrollmentAccepted(enrollmentEvent("enrollment-accepted-1", "ENROLLMENT_ACCEPTED", 100L, 200L, null));

        var notification = notificationRepository.findByEventIdAndRecipientUserId("enrollment-accepted-1", 100L);
        assertThat(notification).isPresent();
        assertThat(notification.get().getType()).isEqualTo("ENROLLMENT_ACCEPTED");
        assertThat(notification.get().getTargetRole()).isEqualTo("STUDENT");
        assertThat(notification.get().getMessage()).contains("đã được chấp nhận");
    }

    @Test
    void enrollmentRejectedIncludesSafeReason() {
        consumer.onEnrollmentRejected(enrollmentEvent("enrollment-rejected-1", "ENROLLMENT_REJECTED", 100L, 200L, "Lịch học không phù hợp"));

        var notification = notificationRepository.findByEventIdAndRecipientUserId("enrollment-rejected-1", 100L);
        assertThat(notification).isPresent();
        assertThat(notification.get().getType()).isEqualTo("ENROLLMENT_REJECTED");
        assertThat(notification.get().getMessage()).contains("Lý do: Lịch học không phù hợp");
    }

    @Test
    void enrollmentCancelledCreatesTutorNotification() {
        consumer.onEnrollmentCancelled(enrollmentEvent("enrollment-cancelled-1", "ENROLLMENT_CANCELLED", 200L, 100L, null));

        var notification = notificationRepository.findByEventIdAndRecipientUserId("enrollment-cancelled-1", 200L);
        assertThat(notification).isPresent();
        assertThat(notification.get().getType()).isEqualTo("ENROLLMENT_CANCELLED");
        assertThat(notification.get().getTargetRole()).isEqualTo("TUTOR");
    }

    private EnrollmentNotificationEvent enrollmentEvent(String eventId, String eventType, Long recipientUserId, Long actorUserId, String reason) {
        return new EnrollmentNotificationEvent(
                eventId,
                eventType,
                LocalDateTime.now(),
                "learning-service",
                500L,
                700L,
                recipientUserId,
                actorUserId,
                "Toán lớp 10",
                eventType == null ? null : eventType.replace("ENROLLMENT_", ""),
                reason,
                "An"
        );
    }
}
