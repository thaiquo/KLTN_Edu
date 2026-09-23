package iuh.fit.learning_service.messaging;

import iuh.fit.learning_service.messaging.event.ClassReviewedNotificationEvent;
import iuh.fit.learning_service.messaging.event.ClassSubmittedNotificationEvent;
import iuh.fit.learning_service.messaging.event.EnrollmentNotificationEvent;
import iuh.fit.learning_service.messaging.event.SubjectRequestSubmittedEvent;
import iuh.fit.learning_service.messaging.event.TeachingRegistrationReviewedEvent;
import iuh.fit.learning_service.messaging.event.TeachingRegistrationSubmittedEvent;
import iuh.fit.learning_service.service.StaffNotificationRecipientLookup;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.eq;

class LearningEventPublisherTest {

    @Test
    void publishEnrollmentRequestedUsesRoutingKeyAndStablePayloadShape() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = newPublisher(rabbitTemplate);
        ArgumentCaptor<EnrollmentNotificationEvent> captor = ArgumentCaptor.forClass(EnrollmentNotificationEvent.class);

        publisher.publishEnrollmentRequested(11L, 22L, 33L, 44L, "Math 10", "An");

        verify(rabbitTemplate).convertAndSend(
                eq(LearningRabbitConfig.EXCHANGE),
                eq(LearningRabbitConfig.ENROLLMENT_REQUESTED_ROUTING_KEY),
                captor.capture()
        );
        EnrollmentNotificationEvent event = captor.getValue();
        assertThat(event.eventId()).isNotBlank();
        assertThat(event.eventType()).isEqualTo("ENROLLMENT_REQUESTED");
        assertThat(event.producer()).isEqualTo("learning-service");
        assertThat(event.enrollmentRequestId()).isEqualTo(11L);
        assertThat(event.classId()).isEqualTo(22L);
        assertThat(event.recipientUserId()).isEqualTo(33L);
        assertThat(event.actorUserId()).isEqualTo(44L);
    }

    @Test
    void publishEnrollmentSkipsSelfNotification() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = newPublisher(rabbitTemplate);

        publisher.publishEnrollmentAccepted(11L, 22L, 33L, 33L, "Math 10", "An");

        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    void publishClassReviewedUsesRoutingKeyAndTutorRecipient() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = newPublisher(rabbitTemplate);
        ArgumentCaptor<ClassReviewedNotificationEvent> captor = ArgumentCaptor.forClass(ClassReviewedNotificationEvent.class);

        publisher.publishClassReviewed(
                22L,
                33L,
                "tutor@example.com",
                "Math 10",
                "APPROVED",
                null,
                "staff@example.com");

        verify(rabbitTemplate).convertAndSend(
                eq(LearningRabbitConfig.EXCHANGE),
                eq(LearningRabbitConfig.CLASS_REVIEWED_ROUTING_KEY),
                captor.capture()
        );

        ClassReviewedNotificationEvent event = captor.getValue();
        assertThat(event.eventId()).isNotBlank();
        assertThat(event.eventType()).isEqualTo("CLASS_REVIEWED");
        assertThat(event.producer()).isEqualTo("learning-service");
        assertThat(event.classId()).isEqualTo(22L);
        assertThat(event.recipientUserId()).isEqualTo(33L);
        assertThat(event.reviewStatus()).isEqualTo("APPROVED");
        assertThat(event.reviewedByEmail()).isEqualTo("staff@example.com");
    }

    @Test
    void publishTeachingRegistrationReviewedUsesRoutingKeyAndTutorRecipient() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = newPublisher(rabbitTemplate);
        ArgumentCaptor<TeachingRegistrationReviewedEvent> captor = ArgumentCaptor.forClass(TeachingRegistrationReviewedEvent.class);

        publisher.publishTeachingRegistrationReviewed(
                44L,
                55L,
                "tutor@example.com",
                66L,
                null,
                "staff@example.com",
                77L,
                "Math",
                "approved",
                null);

        verify(rabbitTemplate).convertAndSend(
                eq(LearningRabbitConfig.EXCHANGE),
                eq(LearningRabbitConfig.TEACHING_REGISTRATION_REVIEWED_ROUTING_KEY),
                captor.capture()
        );

        TeachingRegistrationReviewedEvent event = captor.getValue();
        assertThat(event.eventId()).isNotBlank();
        assertThat(event.eventType()).isEqualTo("TEACHING_REGISTRATION_REVIEWED");
        assertThat(event.producer()).isEqualTo("learning-service");
        assertThat(event.registrationId()).isEqualTo(44L);
        assertThat(event.recipientUserId()).isEqualTo(55L);
        assertThat(event.tutorProfileId()).isEqualTo(66L);
        assertThat(event.subjectId()).isEqualTo(77L);
        assertThat(event.subjectName()).isEqualTo("Math");
        assertThat(event.reviewStatus()).isEqualTo("APPROVED");
        assertThat(event.referenceType()).isEqualTo("TEACHING_REGISTRATION");
        assertThat(event.referenceId()).isEqualTo("44");
    }

    @Test
    void publishTeachingRegistrationSubmittedSendsOneEventPerActiveStaffRecipient() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        StaffNotificationRecipientLookup staffLookup = mock(StaffNotificationRecipientLookup.class);
        when(staffLookup.activeStaffUserIdsExcludingEmail("tutor@example.com")).thenReturn(List.of(900L, 901L));
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate, staffLookup);
        ArgumentCaptor<TeachingRegistrationSubmittedEvent> captor =
                ArgumentCaptor.forClass(TeachingRegistrationSubmittedEvent.class);

        publisher.publishTeachingRegistrationSubmitted(44L, "tutor@example.com", 77L, "Math");

        verify(rabbitTemplate, org.mockito.Mockito.times(2)).convertAndSend(
                eq(LearningRabbitConfig.EXCHANGE),
                eq(LearningRabbitConfig.TEACHING_REGISTRATION_SUBMITTED_ROUTING_KEY),
                captor.capture()
        );

        assertThat(captor.getAllValues()).extracting(TeachingRegistrationSubmittedEvent::eventType)
                .containsOnly("TEACHING_REGISTRATION_SUBMITTED");
        assertThat(captor.getAllValues()).extracting(TeachingRegistrationSubmittedEvent::eventId)
                .containsOnly(captor.getAllValues().get(0).eventId());
        assertThat(captor.getAllValues()).extracting(TeachingRegistrationSubmittedEvent::recipientUserId)
                .containsExactly(900L, 901L);
        assertThat(captor.getAllValues()).extracting(TeachingRegistrationSubmittedEvent::referenceType)
                .containsOnly("TEACHING_REGISTRATION");
    }

    @Test
    void publishSubjectRequestSubmittedSendsStaffNotifications() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        StaffNotificationRecipientLookup staffLookup = mock(StaffNotificationRecipientLookup.class);
        when(staffLookup.activeStaffUserIdsExcludingUserId(123L)).thenReturn(List.of(900L));
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate, staffLookup);
        ArgumentCaptor<SubjectRequestSubmittedEvent> captor =
                ArgumentCaptor.forClass(SubjectRequestSubmittedEvent.class);

        publisher.publishSubjectRequestSubmitted(55L, 123L, "Physics");

        verify(rabbitTemplate).convertAndSend(
                eq(LearningRabbitConfig.EXCHANGE),
                eq(LearningRabbitConfig.SUBJECT_REQUEST_SUBMITTED_ROUTING_KEY),
                captor.capture()
        );

        SubjectRequestSubmittedEvent event = captor.getValue();
        assertThat(event.eventType()).isEqualTo("SUBJECT_REQUEST_SUBMITTED");
        assertThat(event.subjectRequestId()).isEqualTo(55L);
        assertThat(event.recipientUserId()).isEqualTo(900L);
        assertThat(event.requestedByUserId()).isEqualTo(123L);
        assertThat(event.referenceType()).isEqualTo("SUBJECT_REQUEST");
        assertThat(event.referenceId()).isEqualTo("55");
    }

    @Test
    void publishClassSubmittedSendsStaffNotifications() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        StaffNotificationRecipientLookup staffLookup = mock(StaffNotificationRecipientLookup.class);
        when(staffLookup.activeStaffUserIdsExcludingEmail("tutor@example.com")).thenReturn(List.of(900L));
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate, staffLookup);
        ArgumentCaptor<ClassSubmittedNotificationEvent> captor =
                ArgumentCaptor.forClass(ClassSubmittedNotificationEvent.class);

        publisher.publishClassSubmitted(66L, "tutor@example.com", "Math 10");

        verify(rabbitTemplate).convertAndSend(
                eq(LearningRabbitConfig.EXCHANGE),
                eq(LearningRabbitConfig.CLASS_SUBMITTED_ROUTING_KEY),
                captor.capture()
        );

        ClassSubmittedNotificationEvent event = captor.getValue();
        assertThat(event.eventType()).isEqualTo("CLASS_SUBMITTED");
        assertThat(event.classId()).isEqualTo(66L);
        assertThat(event.recipientUserId()).isEqualTo(900L);
        assertThat(event.classTitle()).isEqualTo("Math 10");
        assertThat(event.referenceType()).isEqualTo("CLASS");
        assertThat(event.referenceId()).isEqualTo("66");
    }

    private LearningEventPublisher newPublisher(RabbitTemplate rabbitTemplate) {
        return new LearningEventPublisher(rabbitTemplate, mock(StaffNotificationRecipientLookup.class));
    }
}
