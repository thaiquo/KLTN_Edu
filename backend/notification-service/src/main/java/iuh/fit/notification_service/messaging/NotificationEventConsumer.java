package iuh.fit.notification_service.messaging;

import iuh.fit.notification_service.messaging.event.SubjectRequestApprovedEvent;
import iuh.fit.notification_service.messaging.event.SubjectRequestRejectedEvent;
import iuh.fit.notification_service.messaging.event.ClassSubmittedNotificationEvent;
import iuh.fit.notification_service.messaging.event.ClassReviewedNotificationEvent;
import iuh.fit.notification_service.messaging.event.EnrollmentNotificationEvent;
import iuh.fit.notification_service.messaging.event.HomeworkNotificationEvent;
import iuh.fit.notification_service.messaging.event.TeachingRegistrationReviewedEvent;
import iuh.fit.notification_service.messaging.event.TeachingRegistrationSubmittedEvent;
import iuh.fit.notification_service.messaging.event.SubjectRequestSubmittedEvent;
import iuh.fit.notification_service.messaging.event.TutorApplicationSubmittedEvent;
import iuh.fit.notification_service.messaging.event.TutorApprovedEvent;
import iuh.fit.notification_service.messaging.event.TutorRejectedEvent;
import iuh.fit.notification_service.service.NotificationCommand;
import iuh.fit.notification_service.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class NotificationEventConsumer {
    private static final Logger log = LoggerFactory.getLogger(NotificationEventConsumer.class);

    private final NotificationService notificationService;

    public NotificationEventConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = NotificationRabbitConfig.TUTOR_APPLICATION_SUBMITTED_QUEUE)
    public void onTutorApplicationSubmitted(TutorApplicationSubmittedEvent event) {
        if (event == null
                || !StringUtils.hasText(event.eventId())
                || event.recipientUserId() == null
                || event.applicationId() == null) {
            log.warn("Skipping invalid tutor application submitted notification event");
            return;
        }
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "TUTOR_APPLICATION_SUBMITTED",
                "C\u00f3 h\u1ed3 s\u01a1 gia s\u01b0 m\u1edbi c\u1ea7n x\u00e9t duy\u1ec7t",
                "C\u00f3 h\u1ed3 s\u01a1 \u0111\u0103ng k\u00fd gia s\u01b0 m\u1edbi c\u1ea7n Staff x\u00e9t duy\u1ec7t.",
                "STAFF",
                "TUTOR_APPLICATION",
                String.valueOf(event.applicationId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.TUTOR_APPROVED_QUEUE)
    public void onTutorApproved(TutorApprovedEvent event) {
        if (event == null || !StringUtils.hasText(event.eventId()) || event.userId() == null) {
            log.warn("Skipping invalid tutor approved notification event");
            return;
        }
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.userId(),
                "TUTOR_APPLICATION_REVIEWED",
                "H\u1ed3 s\u01a1 gia s\u01b0 \u0111\u00e3 \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t",
                "H\u1ed3 s\u01a1 gia s\u01b0 c\u1ee7a b\u1ea1n \u0111\u00e3 \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t. B\u1ea1n c\u00f3 th\u1ec3 chuy\u1ec3n sang Gia s\u01b0 khi s\u1eb5n s\u00e0ng.",
                "TUTOR",
                "TUTOR_APPLICATION",
                String.valueOf(event.applicationId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.TUTOR_REJECTED_QUEUE)
    public void onTutorRejected(TutorRejectedEvent event) {
        if (event == null || !StringUtils.hasText(event.eventId()) || event.userId() == null) {
            log.warn("Skipping invalid tutor rejected notification event");
            return;
        }
        String reason = safeReason(event.reason());
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.userId(),
                "TUTOR_APPLICATION_REVIEWED",
                "H\u1ed3 s\u01a1 gia s\u01b0 c\u1ea7n c\u1eadp nh\u1eadt",
                reason == null
                        ? "H\u1ed3 s\u01a1 gia s\u01b0 c\u1ee7a b\u1ea1n ch\u01b0a \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t. Vui l\u00f2ng c\u1eadp nh\u1eadt h\u1ed3 s\u01a1 v\u00e0 g\u1eedi l\u1ea1i."
                        : "H\u1ed3 s\u01a1 gia s\u01b0 c\u1ee7a b\u1ea1n ch\u01b0a \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t. L\u00fd do: " + reason,
                "TUTOR",
                "TUTOR_APPLICATION",
                String.valueOf(event.applicationId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.SUBJECT_REQUEST_APPROVED_QUEUE)
    public void onSubjectRequestApproved(SubjectRequestApprovedEvent event) {
        if (event == null || !StringUtils.hasText(event.eventId()) || event.requestedByUserId() == null) {
            log.warn("Skipping invalid subject request approved notification event");
            return;
        }
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.requestedByUserId(),
                "SUBJECT_REQUEST_REVIEWED",
                "\u0110\u1ec1 xu\u1ea5t m\u00f4n h\u1ecdc \u0111\u00e3 \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t",
                "\u0110\u1ec1 xu\u1ea5t m\u00f4n h\u1ecdc \u0111\u00e3 \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t v\u00e0 th\u00eam v\u00e0o th\u01b0 m\u1ee5c.",
                "TUTOR",
                "SUBJECT_REQUEST",
                String.valueOf(event.subjectRequestId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.SUBJECT_REQUEST_REJECTED_QUEUE)
    public void onSubjectRequestRejected(SubjectRequestRejectedEvent event) {
        if (event == null || !StringUtils.hasText(event.eventId()) || event.requestedByUserId() == null) {
            log.warn("Skipping invalid subject request rejected notification event");
            return;
        }
        String reason = safeReason(event.reason());
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.requestedByUserId(),
                "SUBJECT_REQUEST_REVIEWED",
                "\u0110\u1ec1 xu\u1ea5t m\u00f4n h\u1ecdc ch\u01b0a \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t",
                reason == null
                        ? "\u0110\u1ec1 xu\u1ea5t m\u00f4n h\u1ecdc c\u1ee7a b\u1ea1n ch\u01b0a \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t."
                        : "\u0110\u1ec1 xu\u1ea5t m\u00f4n h\u1ecdc c\u1ee7a b\u1ea1n ch\u01b0a \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t. L\u00fd do: " + reason,
                "TUTOR",
                "SUBJECT_REQUEST",
                String.valueOf(event.subjectRequestId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.ENROLLMENT_REQUESTED_QUEUE)
    public void onEnrollmentRequested(EnrollmentNotificationEvent event) {
        if (!isValidEnrollmentEvent(event, "ENROLLMENT_REQUESTED")) {
            return;
        }
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "ENROLLMENT_REQUESTED",
                "C\u00f3 y\u00eau c\u1ea7u tham gia l\u1edbp m\u1edbi",
                enrollmentRequestedMessage(event),
                "TUTOR",
                "ENROLLMENT_REQUEST",
                String.valueOf(event.enrollmentRequestId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.ENROLLMENT_ACCEPTED_QUEUE)
    public void onEnrollmentAccepted(EnrollmentNotificationEvent event) {
        if (!isValidEnrollmentEvent(event, "ENROLLMENT_ACCEPTED")) {
            return;
        }
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "ENROLLMENT_ACCEPTED",
                "Y\u00eau c\u1ea7u tham gia l\u1edbp \u0111\u00e3 \u0111\u01b0\u1ee3c ch\u1ea5p nh\u1eadn",
                classMessage("Y\u00eau c\u1ea7u tham gia l\u1edbp", event, " \u0111\u00e3 \u0111\u01b0\u1ee3c ch\u1ea5p nh\u1eadn."),
                "STUDENT",
                "ENROLLMENT_REQUEST",
                String.valueOf(event.enrollmentRequestId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.ENROLLMENT_REJECTED_QUEUE)
    public void onEnrollmentRejected(EnrollmentNotificationEvent event) {
        if (!isValidEnrollmentEvent(event, "ENROLLMENT_REJECTED")) {
            return;
        }
        String reason = safeReason(event.rejectReason());
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "ENROLLMENT_REJECTED",
                "Y\u00eau c\u1ea7u tham gia l\u1edbp \u0111\u00e3 b\u1ecb t\u1eeb ch\u1ed1i",
                reason == null
                        ? classMessage("Y\u00eau c\u1ea7u tham gia l\u1edbp", event, " \u0111\u00e3 b\u1ecb t\u1eeb ch\u1ed1i.")
                        : classMessage("Y\u00eau c\u1ea7u tham gia l\u1edbp", event, " \u0111\u00e3 b\u1ecb t\u1eeb ch\u1ed1i. L\u00fd do: " + reason),
                "STUDENT",
                "ENROLLMENT_REQUEST",
                String.valueOf(event.enrollmentRequestId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.ENROLLMENT_CANCELLED_QUEUE)
    public void onEnrollmentCancelled(EnrollmentNotificationEvent event) {
        if (!isValidEnrollmentEvent(event, "ENROLLMENT_CANCELLED")) {
            return;
        }
        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "ENROLLMENT_CANCELLED",
                "Y\u00eau c\u1ea7u tham gia l\u1edbp \u0111\u00e3 \u0111\u01b0\u1ee3c h\u1ee7y",
                classMessage("H\u1ecdc vi\u00ean \u0111\u00e3 h\u1ee7y y\u00eau c\u1ea7u tham gia l\u1edbp", event, "."),
                "TUTOR",
                "ENROLLMENT_REQUEST",
                String.valueOf(event.enrollmentRequestId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.CLASS_REVIEWED_QUEUE)
    public void onClassReviewed(ClassReviewedNotificationEvent event) {
        if (!isValidClassReviewedEvent(event)) {
            return;
        }

        String status = event.reviewStatus().trim().toUpperCase();
        boolean approved = "APPROVED".equals(status);
        String title = approved
                ? "L\u1edbp h\u1ecdc \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t"
                : "L\u1edbp h\u1ecdc ch\u01b0a \u0111\u01b0\u1ee3c duy\u1ec7t";

        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "CLASS_REVIEWED",
                title,
                classReviewedMessage(event, approved),
                "TUTOR",
                "CLASS",
                String.valueOf(event.classId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.TEACHING_REGISTRATION_REVIEWED_QUEUE)
    public void onTeachingRegistrationReviewed(TeachingRegistrationReviewedEvent event) {
        if (!isValidTeachingRegistrationReviewedEvent(event)) {
            return;
        }

        String status = event.reviewStatus().trim().toUpperCase();
        boolean approved = "APPROVED".equals(status);
        String title = approved
                ? "\u0110\u0103ng k\u00fd m\u00f4n h\u1ecdc \u0111\u00e3 \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t"
                : "\u0110\u0103ng k\u00fd m\u00f4n h\u1ecdc \u0111\u00e3 b\u1ecb t\u1eeb ch\u1ed1i";

        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "TEACHING_REGISTRATION_REVIEWED",
                title,
                teachingRegistrationReviewedMessage(event, approved),
                "TUTOR",
                "TEACHING_REGISTRATION",
                String.valueOf(event.registrationId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.TEACHING_REGISTRATION_SUBMITTED_QUEUE)
    public void onTeachingRegistrationSubmitted(TeachingRegistrationSubmittedEvent event) {
        if (!isValidTeachingRegistrationSubmittedEvent(event)) {
            return;
        }

        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "TEACHING_REGISTRATION_SUBMITTED",
                "Có đăng ký giảng dạy mới cần xét duyệt",
                submittedSubjectMessage("Có đăng ký giảng dạy", event.subjectName(), " mới cần xét duyệt."),
                "STAFF",
                "TEACHING_REGISTRATION",
                String.valueOf(event.registrationId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.SUBJECT_REQUEST_SUBMITTED_QUEUE)
    public void onSubjectRequestSubmitted(SubjectRequestSubmittedEvent event) {
        if (!isValidSubjectRequestSubmittedEvent(event)) {
            return;
        }

        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "SUBJECT_REQUEST_SUBMITTED",
                "Có đề xuất môn học mới cần xét duyệt",
                submittedSubjectMessage("Có đề xuất môn học", event.requestedName(), " mới cần xét duyệt."),
                "STAFF",
                "SUBJECT_REQUEST",
                String.valueOf(event.subjectRequestId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.CLASS_SUBMITTED_QUEUE)
    public void onClassSubmitted(ClassSubmittedNotificationEvent event) {
        if (!isValidClassSubmittedEvent(event)) {
            return;
        }

        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "CLASS_SUBMITTED",
                "Có lớp học mới cần xét duyệt",
                submittedSubjectMessage("Có lớp", event.classTitle(), " mới cần xét duyệt."),
                "STAFF",
                "CLASS",
                String.valueOf(event.classId())
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.HOMEWORK_SUBMITTED_QUEUE)
    public void onHomeworkSubmitted(HomeworkNotificationEvent event) {
        if (!isValidHomeworkEvent(event, "HOMEWORK_SUBMITTED")) {
            return;
        }

        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "HOMEWORK_SUBMITTED",
                "Học viên đã nộp bài tập",
                homeworkSubmittedMessage(event),
                "TUTOR",
                "HOMEWORK_SUBMISSION",
                event.referenceId() == null ? String.valueOf(event.attendanceId()) : event.referenceId()
        ));
    }

    @RabbitListener(queues = NotificationRabbitConfig.HOMEWORK_GRADED_QUEUE)
    public void onHomeworkGraded(HomeworkNotificationEvent event) {
        if (!isValidHomeworkEvent(event, "HOMEWORK_GRADED")) {
            return;
        }

        notificationService.createIfAbsent(new NotificationCommand(
                event.eventId(),
                event.recipientUserId(),
                "HOMEWORK_GRADED",
                "Bài tập đã được chấm",
                homeworkGradedMessage(event),
                "STUDENT",
                "HOMEWORK",
                event.referenceId() == null ? String.valueOf(event.sessionId()) : event.referenceId()
        ));
    }

    private String safeReason(String reason) {
        if (!StringUtils.hasText(reason)) {
            return null;
        }
        String trimmed = reason.trim();
        return trimmed.length() <= 400 ? trimmed : trimmed.substring(0, 400);
    }

    private boolean isValidEnrollmentEvent(EnrollmentNotificationEvent event, String expectedType) {
        if (event == null
                || !StringUtils.hasText(event.eventId())
                || event.recipientUserId() == null
                || event.enrollmentRequestId() == null
                || !expectedType.equals(event.eventType())) {
            log.warn("Skipping invalid enrollment notification event type={}", expectedType);
            return false;
        }
        return true;
    }

    private boolean isValidClassReviewedEvent(ClassReviewedNotificationEvent event) {
        if (event == null
                || !StringUtils.hasText(event.eventId())
                || event.recipientUserId() == null
                || event.classId() == null
                || !"CLASS_REVIEWED".equals(event.eventType())
                || !StringUtils.hasText(event.reviewStatus())) {
            log.warn("Skipping invalid class reviewed notification event");
            return false;
        }

        String status = event.reviewStatus().trim().toUpperCase();
        if (!"APPROVED".equals(status) && !"REJECTED".equals(status)) {
            log.warn(
                    "Skipping class reviewed notification event with unsupported status={} eventId={}",
                    event.reviewStatus(),
                    event.eventId());
            return false;
        }
        return true;
    }

    private boolean isValidTeachingRegistrationReviewedEvent(TeachingRegistrationReviewedEvent event) {
        if (event == null
                || !StringUtils.hasText(event.eventId())
                || event.recipientUserId() == null
                || event.registrationId() == null
                || !"TEACHING_REGISTRATION_REVIEWED".equals(event.eventType())
                || !StringUtils.hasText(event.reviewStatus())) {
            log.warn("Skipping invalid teaching registration reviewed notification event");
            return false;
        }

        String status = event.reviewStatus().trim().toUpperCase();
        if (!"APPROVED".equals(status) && !"REJECTED".equals(status)) {
            log.warn(
                    "Skipping teaching registration reviewed notification event with unsupported status={} eventId={}",
                    event.reviewStatus(),
                    event.eventId());
            return false;
        }
        return true;
    }

    private boolean isValidTeachingRegistrationSubmittedEvent(TeachingRegistrationSubmittedEvent event) {
        if (event == null
                || !StringUtils.hasText(event.eventId())
                || event.recipientUserId() == null
                || event.registrationId() == null
                || !"TEACHING_REGISTRATION_SUBMITTED".equals(event.eventType())) {
            log.warn("Skipping invalid teaching registration submitted notification event");
            return false;
        }
        return true;
    }

    private boolean isValidSubjectRequestSubmittedEvent(SubjectRequestSubmittedEvent event) {
        if (event == null
                || !StringUtils.hasText(event.eventId())
                || event.recipientUserId() == null
                || event.subjectRequestId() == null
                || !"SUBJECT_REQUEST_SUBMITTED".equals(event.eventType())) {
            log.warn("Skipping invalid subject request submitted notification event");
            return false;
        }
        return true;
    }

    private boolean isValidClassSubmittedEvent(ClassSubmittedNotificationEvent event) {
        if (event == null
                || !StringUtils.hasText(event.eventId())
                || event.recipientUserId() == null
                || event.classId() == null
                || !"CLASS_SUBMITTED".equals(event.eventType())) {
            log.warn("Skipping invalid class submitted notification event");
            return false;
        }
        return true;
    }

    private String enrollmentRequestedMessage(EnrollmentNotificationEvent event) {
        String studentName = safeReason(event.studentName());
        if (StringUtils.hasText(studentName)) {
            return classMessage(studentName + " \u0111\u00e3 g\u1eedi y\u00eau c\u1ea7u tham gia l\u1edbp", event, ".");
        }
        return classMessage("C\u00f3 h\u1ecdc vi\u00ean v\u1eeba g\u1eedi y\u00eau c\u1ea7u tham gia l\u1edbp c\u1ee7a b\u1ea1n", event, ".");
    }

    private boolean isValidHomeworkEvent(HomeworkNotificationEvent event, String expectedType) {
        if (event == null
                || !StringUtils.hasText(event.eventId())
                || event.recipientUserId() == null
                || event.sessionId() == null
                || event.attendanceId() == null
                || !expectedType.equals(event.eventType())) {
            log.warn("Skipping invalid homework notification event type={}", expectedType);
            return false;
        }
        return true;
    }

    private String classMessage(String prefix, EnrollmentNotificationEvent event, String suffix) {
        String classTitle = safeReason(event.classTitle());
        if (StringUtils.hasText(classTitle)) {
            return prefix + " \"" + classTitle + "\"" + suffix;
        }
        return prefix + suffix;
    }

    private String homeworkSubmittedMessage(HomeworkNotificationEvent event) {
        String studentName = safeReason(event.studentName());
        String subject = StringUtils.hasText(studentName) ? studentName : "H\u1ecdc vi\u00ean";
        return subject + " \u0111\u00e3 n\u1ed9p b\u00e0i t\u1eadp" + homeworkContext(event) + ".";
    }

    private String homeworkGradedMessage(HomeworkNotificationEvent event) {
        String score = safeReason(event.gradeScore());
        String suffix = StringUtils.hasText(score)
                ? ". \u0110i\u1ec3m/\u0111\u00e1nh gi\u00e1: " + score + "."
                : ".";
        return "B\u00e0i t\u1eadp c\u1ee7a b\u1ea1n" + homeworkContext(event) + " \u0111\u00e3 \u0111\u01b0\u1ee3c gia s\u01b0 ch\u1ea5m" + suffix;
    }

    private String homeworkContext(HomeworkNotificationEvent event) {
        String classTitle = safeReason(event.classTitle());
        String topic = safeReason(event.sessionTopic());
        StringBuilder builder = new StringBuilder();
        if (StringUtils.hasText(classTitle)) {
            builder.append(" l\u1edbp \"").append(classTitle).append("\"");
        }
        if (event.sequenceNumber() != null) {
            builder.append(", bu\u1ed5i #").append(event.sequenceNumber());
        }
        if (StringUtils.hasText(topic)) {
            builder.append(" - ").append(topic);
        }
        return builder.toString();
    }

    private String teachingRegistrationReviewedMessage(TeachingRegistrationReviewedEvent event, boolean approved) {
        String subjectName = safeReason(event.subjectName());
        String prefix = StringUtils.hasText(subjectName)
                ? "\u0110\u0103ng k\u00fd m\u00f4n h\u1ecdc \"" + subjectName + "\" c\u1ee7a b\u1ea1n"
                : "\u0110\u0103ng k\u00fd m\u00f4n h\u1ecdc c\u1ee7a b\u1ea1n";

        if (approved) {
            return prefix + " \u0111\u00e3 \u0111\u01b0\u1ee3c ph\u00ea duy\u1ec7t.";
        }

        String reason = safeReason(event.rejectReason());
        return reason == null
                ? prefix + " \u0111\u00e3 b\u1ecb t\u1eeb ch\u1ed1i."
                : prefix + " \u0111\u00e3 b\u1ecb t\u1eeb ch\u1ed1i. L\u00fd do: " + reason;
    }

    private String submittedSubjectMessage(String prefix, String subject, String suffix) {
        String value = safeReason(subject);
        if (StringUtils.hasText(value)) {
            return prefix + " \"" + value + "\"" + suffix;
        }
        return prefix + suffix;
    }

    private String classReviewedMessage(ClassReviewedNotificationEvent event, boolean approved) {
        String classTitle = safeReason(event.classTitle());
        String prefix;
        if (StringUtils.hasText(classTitle)) {
            prefix = "L\u1edbp \"" + classTitle + "\" c\u1ee7a b\u1ea1n";
        } else {
            prefix = "L\u1edbp h\u1ecdc c\u1ee7a b\u1ea1n";
        }

        if (approved) {
            return prefix + " \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t.";
        }

        String reason = safeReason(event.rejectReason());
        return reason == null
                ? prefix + " ch\u01b0a \u0111\u01b0\u1ee3c duy\u1ec7t."
                : prefix + " ch\u01b0a \u0111\u01b0\u1ee3c duy\u1ec7t. L\u00fd do: " + reason;
    }
}
