package iuh.fit.notification_service.messaging;

import iuh.fit.notification_service.messaging.event.SubjectRequestApprovedEvent;
import iuh.fit.notification_service.messaging.event.SubjectRequestRejectedEvent;
import iuh.fit.notification_service.messaging.event.EnrollmentNotificationEvent;
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
        log.info(
                "Skipping persistent notification for eventId={} type=TUTOR_APPLICATION_SUBMITTED: reviewer recipient ids are not available",
                event == null ? null : event.eventId()
        );
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
                "Hồ sơ gia sư đã được phê duyệt",
                "Hồ sơ gia sư của bạn đã được phê duyệt. Bạn có thể chuyển sang Gia sư khi sẵn sàng.",
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
                "Hồ sơ gia sư cần cập nhật",
                reason == null
                        ? "Hồ sơ gia sư của bạn chưa được phê duyệt. Vui lòng cập nhật hồ sơ và gửi lại."
                        : "Hồ sơ gia sư của bạn chưa được phê duyệt. Lý do: " + reason,
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
                "Đề xuất môn học đã được phê duyệt",
                "Đề xuất môn học đã được phê duyệt và thêm vào thư mục.",
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
                "Đề xuất môn học chưa được phê duyệt",
                reason == null
                        ? "Đề xuất môn học của bạn chưa được phê duyệt."
                        : "Đề xuất môn học của bạn chưa được phê duyệt. Lý do: " + reason,
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
                "Có yêu cầu tham gia lớp mới",
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
                "Yêu cầu tham gia lớp đã được chấp nhận",
                classMessage("Yêu cầu tham gia lớp", event, " đã được chấp nhận."),
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
                "Yêu cầu tham gia lớp đã bị từ chối",
                reason == null
                        ? classMessage("Yêu cầu tham gia lớp", event, " đã bị từ chối.")
                        : classMessage("Yêu cầu tham gia lớp", event, " đã bị từ chối. Lý do: " + reason),
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
                "Yêu cầu tham gia lớp đã được hủy",
                classMessage("Học viên đã hủy yêu cầu tham gia lớp", event, "."),
                "TUTOR",
                "ENROLLMENT_REQUEST",
                String.valueOf(event.enrollmentRequestId())
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

    private String enrollmentRequestedMessage(EnrollmentNotificationEvent event) {
        String studentName = safeReason(event.studentName());
        if (StringUtils.hasText(studentName)) {
            return classMessage(studentName + " đã gửi yêu cầu tham gia lớp", event, ".");
        }
        return classMessage("Có học viên vừa gửi yêu cầu tham gia lớp của bạn", event, ".");
    }

    private String classMessage(String prefix, EnrollmentNotificationEvent event, String suffix) {
        String classTitle = safeReason(event.classTitle());
        if (StringUtils.hasText(classTitle)) {
            return prefix + " \"" + classTitle + "\"" + suffix;
        }
        return prefix + suffix;
    }
}
