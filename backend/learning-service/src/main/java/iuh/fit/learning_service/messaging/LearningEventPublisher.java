package iuh.fit.learning_service.messaging;

import iuh.fit.learning_service.messaging.event.SubjectRequestApprovedEvent;
import iuh.fit.learning_service.messaging.event.SubjectRequestRejectedEvent;
import iuh.fit.learning_service.messaging.event.ClassReviewedNotificationEvent;
import iuh.fit.learning_service.messaging.event.ClassSubmittedNotificationEvent;
import iuh.fit.learning_service.messaging.event.EnrollmentNotificationEvent;
import iuh.fit.learning_service.messaging.event.SubjectRequestSubmittedEvent;
import iuh.fit.learning_service.messaging.event.TeachingRegistrationReviewedEvent;
import iuh.fit.learning_service.messaging.event.TeachingRegistrationSubmittedEvent;
import iuh.fit.learning_service.service.StaffNotificationRecipientLookup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Component
public class LearningEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(LearningEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final StaffNotificationRecipientLookup staffRecipientLookup;

    public LearningEventPublisher(RabbitTemplate rabbitTemplate, StaffNotificationRecipientLookup staffRecipientLookup) {
        this.rabbitTemplate = rabbitTemplate;
        this.staffRecipientLookup = staffRecipientLookup;
    }

    public void publishSubjectRequestApproved(Long requestId, Long requestedByUserId, Long approvedSubjectId) {
        publishAfterCommit(
                LearningRabbitConfig.EXCHANGE,
                LearningRabbitConfig.SUBJECT_REQUEST_APPROVED_ROUTING_KEY,
                new SubjectRequestApprovedEvent(UUID.randomUUID().toString(), requestId, requestedByUserId, approvedSubjectId, LocalDateTime.now())
        );
    }

    public void publishSubjectRequestRejected(Long requestId, Long requestedByUserId, String reason) {
        publishAfterCommit(
                LearningRabbitConfig.EXCHANGE,
                LearningRabbitConfig.SUBJECT_REQUEST_REJECTED_ROUTING_KEY,
                new SubjectRequestRejectedEvent(UUID.randomUUID().toString(), requestId, requestedByUserId, reason, LocalDateTime.now())
        );
    }

    public void publishTeachingRegistrationSubmitted(Long registrationId, String tutorEmail, Long subjectId, String subjectName) {
        String eventId = UUID.randomUUID().toString();
        for (Long staffUserId : activeStaffUserIdsExcludingEmail(tutorEmail)) {
            publishAfterCommit(
                    LearningRabbitConfig.EXCHANGE,
                    LearningRabbitConfig.TEACHING_REGISTRATION_SUBMITTED_ROUTING_KEY,
                    new TeachingRegistrationSubmittedEvent(
                            eventId,
                            "TEACHING_REGISTRATION_SUBMITTED",
                            LocalDateTime.now(),
                            "learning-service",
                            registrationId,
                            staffUserId,
                            tutorEmail,
                            subjectId,
                            subjectName,
                            "TEACHING_REGISTRATION",
                            String.valueOf(registrationId)
                    )
            );
        }
    }

    public void publishSubjectRequestSubmitted(Long requestId, Long requestedByUserId, String requestedName) {
        String eventId = UUID.randomUUID().toString();
        for (Long staffUserId : activeStaffUserIdsExcludingUserId(requestedByUserId)) {
            publishAfterCommit(
                    LearningRabbitConfig.EXCHANGE,
                    LearningRabbitConfig.SUBJECT_REQUEST_SUBMITTED_ROUTING_KEY,
                    new SubjectRequestSubmittedEvent(
                            eventId,
                            "SUBJECT_REQUEST_SUBMITTED",
                            LocalDateTime.now(),
                            "learning-service",
                            requestId,
                            staffUserId,
                            requestedByUserId,
                            requestedName,
                            "SUBJECT_REQUEST",
                            String.valueOf(requestId)
                    )
            );
        }
    }

    public void publishClassSubmitted(Long classId, String tutorEmail, String classTitle) {
        String eventId = UUID.randomUUID().toString();
        for (Long staffUserId : activeStaffUserIdsExcludingEmail(tutorEmail)) {
            publishAfterCommit(
                    LearningRabbitConfig.EXCHANGE,
                    LearningRabbitConfig.CLASS_SUBMITTED_ROUTING_KEY,
                    new ClassSubmittedNotificationEvent(
                            eventId,
                            "CLASS_SUBMITTED",
                            LocalDateTime.now(),
                            "learning-service",
                            classId,
                            staffUserId,
                            tutorEmail,
                            classTitle,
                            "CLASS",
                            String.valueOf(classId)
                    )
            );
        }
    }

    public void publishEnrollmentRequested(Long requestId, Long classId, Long recipientUserId, Long actorUserId, String classTitle, String studentName) {
        publishEnrollment(
                LearningRabbitConfig.ENROLLMENT_REQUESTED_ROUTING_KEY,
                "ENROLLMENT_REQUESTED",
                requestId,
                classId,
                recipientUserId,
                actorUserId,
                classTitle,
                "PENDING",
                null,
                studentName
        );
    }

    public void publishEnrollmentAccepted(Long requestId, Long classId, Long recipientUserId, Long actorUserId, String classTitle, String studentName) {
        publishEnrollment(
                LearningRabbitConfig.ENROLLMENT_ACCEPTED_ROUTING_KEY,
                "ENROLLMENT_ACCEPTED",
                requestId,
                classId,
                recipientUserId,
                actorUserId,
                classTitle,
                "ACCEPTED",
                null,
                studentName
        );
    }

    public void publishEnrollmentRejected(Long requestId, Long classId, Long recipientUserId, Long actorUserId, String classTitle, String reason, String studentName) {
        publishEnrollment(
                LearningRabbitConfig.ENROLLMENT_REJECTED_ROUTING_KEY,
                "ENROLLMENT_REJECTED",
                requestId,
                classId,
                recipientUserId,
                actorUserId,
                classTitle,
                "REJECTED",
                reason,
                studentName
        );
    }

    public void publishEnrollmentCancelled(Long requestId, Long classId, Long recipientUserId, Long actorUserId, String classTitle, String studentName) {
        publishEnrollment(
                LearningRabbitConfig.ENROLLMENT_CANCELLED_ROUTING_KEY,
                "ENROLLMENT_CANCELLED",
                requestId,
                classId,
                recipientUserId,
                actorUserId,
                classTitle,
                "CANCELLED",
                null,
                studentName
        );
    }

    public void publishClassReviewed(
            Long classId,
            Long recipientUserId,
            String tutorEmail,
            String classTitle,
            String reviewStatus,
            String rejectReason,
            String reviewedByEmail
    ) {
        if (classId == null || recipientUserId == null) {
            log.warn(
                    "Skipping class reviewed notification event classId={} recipientUserId={} status={}",
                    classId,
                    recipientUserId,
                    reviewStatus);
            return;
        }

        ClassReviewedNotificationEvent event = new ClassReviewedNotificationEvent(
                UUID.randomUUID().toString(),
                "CLASS_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                classId,
                recipientUserId,
                tutorEmail,
                classTitle,
                reviewStatus,
                rejectReason,
                reviewedByEmail
        );

        log.info(
                "Scheduling class reviewed notification eventId={} classId={} recipientUserId={} status={}",
                event.eventId(),
                event.classId(),
                event.recipientUserId(),
                event.reviewStatus());

        publishAfterCommit(
                LearningRabbitConfig.EXCHANGE,
                LearningRabbitConfig.CLASS_REVIEWED_ROUTING_KEY,
                event
        );
    }

    public void publishTeachingRegistrationReviewed(
            Long registrationId,
            Long recipientUserId,
            String tutorEmail,
            Long tutorProfileId,
            Long reviewerUserId,
            String reviewerEmail,
            Long subjectId,
            String subjectName,
            String reviewStatus,
            String rejectReason
    ) {
        if (registrationId == null || recipientUserId == null || reviewStatus == null || reviewStatus.isBlank()) {
            log.warn(
                    "Skipping teaching registration reviewed notification event registrationId={} recipientUserId={} status={}",
                    registrationId,
                    recipientUserId,
                    reviewStatus);
            return;
        }

        String normalizedStatus = reviewStatus.trim().toUpperCase();
        TeachingRegistrationReviewedEvent event = new TeachingRegistrationReviewedEvent(
                UUID.randomUUID().toString(),
                "TEACHING_REGISTRATION_REVIEWED",
                LocalDateTime.now(),
                "learning-service",
                registrationId,
                recipientUserId,
                tutorEmail,
                tutorProfileId,
                reviewerUserId,
                reviewerEmail,
                subjectId,
                subjectName,
                normalizedStatus,
                rejectReason,
                "TEACHING_REGISTRATION",
                String.valueOf(registrationId)
        );

        log.info(
                "Scheduling teaching registration reviewed notification eventId={} registrationId={} recipientUserId={} status={}",
                event.eventId(),
                event.registrationId(),
                event.recipientUserId(),
                event.reviewStatus());

        publishAfterCommit(
                LearningRabbitConfig.EXCHANGE,
                LearningRabbitConfig.TEACHING_REGISTRATION_REVIEWED_ROUTING_KEY,
                event
        );
    }

    private void publishEnrollment(
            String routingKey,
            String eventType,
            Long requestId,
            Long classId,
            Long recipientUserId,
            Long actorUserId,
            String classTitle,
            String reviewStatus,
            String rejectReason,
            String studentName
    ) {
        if (recipientUserId == null || (actorUserId != null && actorUserId.equals(recipientUserId))) {
            return;
        }
        publishAfterCommit(
                LearningRabbitConfig.EXCHANGE,
                routingKey,
                new EnrollmentNotificationEvent(
                        UUID.randomUUID().toString(),
                        eventType,
                        LocalDateTime.now(),
                        "learning-service",
                        requestId,
                        classId,
                        recipientUserId,
                        actorUserId,
                        classTitle,
                        reviewStatus,
                        rejectReason,
                        studentName
                )
        );
    }

    private void publishAfterCommit(String exchange, String routingKey, Object event) {
        Runnable action = () -> {
            try {
                rabbitTemplate.convertAndSend(exchange, routingKey, event);
                log.info(
                        "Published RabbitMQ event routingKey={} payloadType={}",
                        routingKey,
                        event == null ? null : event.getClass().getSimpleName());
            } catch (Exception ex) {
                log.warn(
                        "Failed to publish RabbitMQ event routingKey={} payloadType={}",
                        routingKey,
                        event == null ? null : event.getClass().getSimpleName(),
                        ex);
            }
        };
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private List<Long> activeStaffUserIdsExcludingUserId(Long excludedUserId) {
        return staffRecipientLookup.activeStaffUserIdsExcludingUserId(excludedUserId);
    }

    private List<Long> activeStaffUserIdsExcludingEmail(String excludedEmail) {
        return staffRecipientLookup.activeStaffUserIdsExcludingEmail(excludedEmail);
    }
}
