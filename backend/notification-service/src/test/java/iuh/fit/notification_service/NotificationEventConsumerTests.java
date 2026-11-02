package iuh.fit.notification_service;

import iuh.fit.notification_service.messaging.NotificationEventConsumer;
import iuh.fit.notification_service.messaging.event.SubjectRequestApprovedEvent;
import iuh.fit.notification_service.messaging.event.SubjectRequestRejectedEvent;
import iuh.fit.notification_service.messaging.event.TeachingRegistrationSubmittedEvent;
import iuh.fit.notification_service.messaging.event.EnrollmentNotificationEvent;
import iuh.fit.notification_service.messaging.event.TeachingRegistrationReviewedEvent;
import iuh.fit.notification_service.messaging.event.TutorApplicationSubmittedEvent;
import iuh.fit.notification_service.messaging.event.TutorApprovedEvent;
import iuh.fit.notification_service.messaging.event.TutorRejectedEvent;
import iuh.fit.notification_service.messaging.event.ClassReviewedNotificationEvent;
import iuh.fit.notification_service.messaging.event.CommunityPostModeratedEvent;
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
        var event = new TutorApprovedEvent("approved-1", 101L, 202L, 303L, Set.of("ONLINE"), Set.of(), LocalDateTime.now());

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
    void classApprovedAndRejectedCreatePersistentNotifications() {
        consumer.onClassReviewed(new ClassReviewedNotificationEvent(
                "class-approved-1", "CLASS_REVIEWED", LocalDateTime.now(), "learning-service",
                501L, 301L, "tutor@example.com", "Toán 10", "APPROVED", null, "staff@example.com"));
        consumer.onClassReviewed(new ClassReviewedNotificationEvent(
                "class-rejected-1", "CLASS_REVIEWED", LocalDateTime.now(), "learning-service",
                502L, 301L, "tutor@example.com", "Toán 11", "REJECTED", "Thiếu giáo trình", "staff@example.com"));

        assertThat(notificationRepository.findByEventIdAndRecipientUserId("class-approved-1", 301L)).isPresent();
        assertThat(notificationRepository.findByEventIdAndRecipientUserId("class-rejected-1", 301L))
                .get().extracting("message").asString().contains("Thiếu giáo trình");
    }

    @Test
    void communityHumanReviewOutcomesNotifyAuthorAndDeduplicate() {
        var approved = new CommunityPostModeratedEvent(
                "community-reviewed-1", "COMMUNITY_POST_REVIEWED", LocalDateTime.now(), "learning-service",
                91L, 202L, "STUDENT", "Tìm gia sư Toán", "APPROVED", "Nội dung hợp lệ", 1L,
                "COMMUNITY_POST", "91");
        var rejected = new CommunityPostModeratedEvent(
                "community-reviewed-2", "COMMUNITY_POST_REVIEWED", LocalDateTime.now(), "learning-service",
                92L, 203L, "TUTOR", "Bài viết chưa rõ", "REJECTED", "Không đủ ngữ cảnh giáo dục", 5L,
                "COMMUNITY_POST", "92");

        consumer.onCommunityPostModerated(approved);
        consumer.onCommunityPostModerated(approved);
        consumer.onCommunityPostModerated(rejected);

        var approvedNotification = notificationRepository
                .findByEventIdAndRecipientUserId("community-reviewed-1", 202L).orElseThrow();
        var rejectedNotification = notificationRepository
                .findByEventIdAndRecipientUserId("community-reviewed-2", 203L).orElseThrow();
        assertThat(approvedNotification.getReadAt()).isNull();
        assertThat(approvedNotification.getReferenceType()).isEqualTo("COMMUNITY_POST");
        assertThat(rejectedNotification.getMessage()).contains("Không đủ ngữ cảnh giáo dục");
        assertThat(notificationRepository.count()).isEqualTo(2);
    }

    @Test
    void communityRevisionReviewOutcomesUseRevisionSpecificPersistentNotifications() {
        var approved = new CommunityPostModeratedEvent(
                "community-revision-reviewed-1", "COMMUNITY_POST_REVISION_REVIEWED", LocalDateTime.now(),
                "learning-service", 93L, 202L, "STUDENT", "Bài viết đã sửa", "APPROVED",
                "Nội dung hợp lệ", 1L, "COMMUNITY_POST", "93");
        var rejected = new CommunityPostModeratedEvent(
                "community-revision-reviewed-2", "COMMUNITY_POST_REVISION_REVIEWED", LocalDateTime.now(),
                "learning-service", 94L, 203L, "TUTOR", "Bài viết đã sửa", "REJECTED",
                "Nội dung còn mơ hồ", 5L, "COMMUNITY_POST", "94");

        consumer.onCommunityPostModerated(approved);
        consumer.onCommunityPostModerated(rejected);

        var approvedNotification = notificationRepository
                .findByEventIdAndRecipientUserId("community-revision-reviewed-1", 202L).orElseThrow();
        var rejectedNotification = notificationRepository
                .findByEventIdAndRecipientUserId("community-revision-reviewed-2", 203L).orElseThrow();
        assertThat(approvedNotification.getType()).isEqualTo("COMMUNITY_POST_REVISION_REVIEWED");
        assertThat(approvedNotification.getMessage()).contains("Bản chỉnh sửa bài viết của bạn đã được duyệt");
        assertThat(rejectedNotification.getMessage())
                .contains("Bản chỉnh sửa bài viết của bạn đã bị từ chối")
                .contains("Nội dung còn mơ hồ");
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
        consumer.onTutorApproved(new TutorApprovedEvent(null, 101L, 202L, 303L, Set.of("ONLINE"), Set.of(), LocalDateTime.now()));
        consumer.onSubjectRequestApproved(new SubjectRequestApprovedEvent("invalid-subject", 10L, null, 30L, LocalDateTime.now()));
        consumer.onEnrollmentRequested(enrollmentEvent("invalid-enrollment", "ENROLLMENT_REQUESTED", null, 100L, null));

        assertThat(notificationRepository.count()).isZero();
    }

    @Test
    void submittedTutorApplicationCreatesStaffNotificationAndDeduplicates() {
        var event = new TutorApplicationSubmittedEvent("submitted-2", 1L, 2L, 900L, LocalDateTime.now());

        consumer.onTutorApplicationSubmitted(event);
        consumer.onTutorApplicationSubmitted(event);

        var notification = notificationRepository.findByEventIdAndRecipientUserId("submitted-2", 900L);
        assertThat(notification).isPresent();
        assertThat(notification.get().getType()).isEqualTo("TUTOR_APPLICATION_SUBMITTED");
        assertThat(notification.get().getTargetRole()).isEqualTo("STAFF");
        assertThat(notification.get().getReferenceType()).isEqualTo("TUTOR_APPLICATION");
        assertThat(notification.get().getRecipientUserId()).isEqualTo(900L);
        assertThat(notificationRepository.count()).isEqualTo(1);
    }

    @Test
    void submittedTeachingRegistrationCreatesIndependentStaffNotifications() {
        var firstStaff = new TeachingRegistrationSubmittedEvent(
                "teaching-submitted-1",
                "TEACHING_REGISTRATION_SUBMITTED",
                LocalDateTime.now(),
                "learning-service",
                88L,
                900L,
                "tutor@example.com",
                400L,
                "Toan lop 10",
                "TEACHING_REGISTRATION",
                "88");
        var secondStaff = new TeachingRegistrationSubmittedEvent(
                "teaching-submitted-1",
                "TEACHING_REGISTRATION_SUBMITTED",
                firstStaff.occurredAt(),
                "learning-service",
                88L,
                901L,
                "tutor@example.com",
                400L,
                "Toan lop 10",
                "TEACHING_REGISTRATION",
                "88");

        consumer.onTeachingRegistrationSubmitted(firstStaff);
        consumer.onTeachingRegistrationSubmitted(secondStaff);
        consumer.onTeachingRegistrationSubmitted(firstStaff);

        assertThat(notificationRepository.findByEventIdAndRecipientUserId("teaching-submitted-1", 900L)).isPresent();
        assertThat(notificationRepository.findByEventIdAndRecipientUserId("teaching-submitted-1", 901L)).isPresent();
        assertThat(notificationRepository.findAll())
                .extracting("type")
                .containsOnly("TEACHING_REGISTRATION_SUBMITTED");
        assertThat(notificationRepository.count()).isEqualTo(2);
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

    @Test
    void teachingRegistrationReviewedCreatesTutorNotificationAndDeduplicates() {
        var event = new TeachingRegistrationReviewedEvent(
                "teaching-reviewed-1",
                "TEACHING_REGISTRATION_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                88L,
                200L,
                "tutor@example.com",
                300L,
                null,
                "staff@example.com",
                400L,
                "ToÃ¡n lá»›p 10",
                "REJECTED",
                "Thiáº¿u minh chá»©ng",
                "TEACHING_REGISTRATION",
                "88");

        consumer.onTeachingRegistrationReviewed(event);
        consumer.onTeachingRegistrationReviewed(event);

        var notification = notificationRepository.findByEventIdAndRecipientUserId("teaching-reviewed-1", 200L);
        assertThat(notification).isPresent();
        assertThat(notification.get().getType()).isEqualTo("TEACHING_REGISTRATION_REVIEWED");
        assertThat(notification.get().getTargetRole()).isEqualTo("TUTOR");
        assertThat(notification.get().getReferenceType()).isEqualTo("TEACHING_REGISTRATION");
        assertThat(notification.get().getReferenceId()).isEqualTo("88");
        assertThat(notification.get().getMessage()).contains("Lý do");
        assertThat(notificationRepository.count()).isEqualTo(1);
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
