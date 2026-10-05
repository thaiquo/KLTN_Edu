package iuh.fit.learning_service.messaging;

import iuh.fit.learning_service.messaging.event.ClassReviewedNotificationEvent;
import iuh.fit.learning_service.messaging.event.EnrollmentNotificationEvent;
import iuh.fit.learning_service.messaging.event.TeachingRegistrationReviewedEvent;
import iuh.fit.learning_service.messaging.event.CommunityPostConvertedEvent;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.eq;

class LearningEventPublisherTest {

    @Test
    void publishCommunityConversionUsesStableRecipientEventId() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate);
        ArgumentCaptor<CommunityPostConvertedEvent> captor =
                ArgumentCaptor.forClass(CommunityPostConvertedEvent.class);

        publisher.publishCommunityPostConverted(
                10L, 20L, 30L, 40L, "Khảo sát Toán", "Lớp Toán", "Gia sư A");

        verify(rabbitTemplate).convertAndSend(
                eq(LearningRabbitConfig.EXCHANGE),
                eq(LearningRabbitConfig.COMMUNITY_POST_CONVERTED_ROUTING_KEY),
                captor.capture());
        CommunityPostConvertedEvent event = captor.getValue();
        assertThat(event.eventId()).isEqualTo("community-post-converted:10:20:30");
        assertThat(event.eventType()).isEqualTo("COMMUNITY_POST_CONVERTED_TO_CLASS");
        assertThat(event.recipientUserId()).isEqualTo(30L);
        assertThat(event.referenceType()).isEqualTo("COMMUNITY_POST");
        assertThat(event.referenceId()).isEqualTo("10");
    }

    @Test
    void publishEnrollmentRequestedUsesRoutingKeyAndStablePayloadShape() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate);
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
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate);

        publisher.publishEnrollmentAccepted(11L, 22L, 33L, 33L, "Math 10", "An");

        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    void publishClassReviewedUsesRoutingKeyAndTutorRecipient() {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate);
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
        LearningEventPublisher publisher = new LearningEventPublisher(rabbitTemplate);
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
}
