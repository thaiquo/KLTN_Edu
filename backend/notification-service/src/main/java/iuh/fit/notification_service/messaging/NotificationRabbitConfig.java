package iuh.fit.notification_service.messaging;

import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@EnableRabbit
@Configuration
public class NotificationRabbitConfig {
    public static final String EXCHANGE = "kltn.edu.events";

    public static final String TUTOR_APPLICATION_SUBMITTED_QUEUE = "notification.tutor-application-submitted";
    public static final String TUTOR_APPROVED_QUEUE = "notification.tutor-approved";
    public static final String TUTOR_REJECTED_QUEUE = "notification.tutor-rejected";
    public static final String SUBJECT_REQUEST_APPROVED_QUEUE = "notification.subject-request-approved";
    public static final String SUBJECT_REQUEST_REJECTED_QUEUE = "notification.subject-request-rejected";
    public static final String ENROLLMENT_REQUESTED_QUEUE = "notification.enrollment-requested";
    public static final String ENROLLMENT_ACCEPTED_QUEUE = "notification.enrollment-accepted";
    public static final String ENROLLMENT_REJECTED_QUEUE = "notification.enrollment-rejected";
    public static final String ENROLLMENT_CANCELLED_QUEUE = "notification.enrollment-cancelled";

    public static final String TUTOR_APPLICATION_SUBMITTED_ROUTING_KEY = "account.tutor-application.submitted";
    public static final String TUTOR_APPROVED_ROUTING_KEY = "account.tutor.approved";
    public static final String TUTOR_REJECTED_ROUTING_KEY = "account.tutor.rejected";
    public static final String SUBJECT_REQUEST_APPROVED_ROUTING_KEY = "learning.subject-request.approved";
    public static final String SUBJECT_REQUEST_REJECTED_ROUTING_KEY = "learning.subject-request.rejected";
    public static final String ENROLLMENT_REQUESTED_ROUTING_KEY = "learning.enrollment.requested";
    public static final String ENROLLMENT_ACCEPTED_ROUTING_KEY = "learning.enrollment.accepted";
    public static final String ENROLLMENT_REJECTED_ROUTING_KEY = "learning.enrollment.rejected";
    public static final String ENROLLMENT_CANCELLED_ROUTING_KEY = "learning.enrollment.cancelled";

    @Bean
    DirectExchange eduEventsExchange() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    Queue notificationTutorApplicationSubmittedQueue() {
        return new Queue(TUTOR_APPLICATION_SUBMITTED_QUEUE, true);
    }

    @Bean
    Queue notificationTutorApprovedQueue() {
        return new Queue(TUTOR_APPROVED_QUEUE, true);
    }

    @Bean
    Queue notificationTutorRejectedQueue() {
        return new Queue(TUTOR_REJECTED_QUEUE, true);
    }

    @Bean
    Queue notificationSubjectRequestApprovedQueue() {
        return new Queue(SUBJECT_REQUEST_APPROVED_QUEUE, true);
    }

    @Bean
    Queue notificationSubjectRequestRejectedQueue() {
        return new Queue(SUBJECT_REQUEST_REJECTED_QUEUE, true);
    }

    @Bean
    Queue notificationEnrollmentRequestedQueue() {
        return new Queue(ENROLLMENT_REQUESTED_QUEUE, true);
    }

    @Bean
    Queue notificationEnrollmentAcceptedQueue() {
        return new Queue(ENROLLMENT_ACCEPTED_QUEUE, true);
    }

    @Bean
    Queue notificationEnrollmentRejectedQueue() {
        return new Queue(ENROLLMENT_REJECTED_QUEUE, true);
    }

    @Bean
    Queue notificationEnrollmentCancelledQueue() {
        return new Queue(ENROLLMENT_CANCELLED_QUEUE, true);
    }

    @Bean
    Binding notificationTutorApplicationSubmittedBinding(Queue notificationTutorApplicationSubmittedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationTutorApplicationSubmittedQueue).to(eduEventsExchange).with(TUTOR_APPLICATION_SUBMITTED_ROUTING_KEY);
    }

    @Bean
    Binding notificationTutorApprovedBinding(Queue notificationTutorApprovedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationTutorApprovedQueue).to(eduEventsExchange).with(TUTOR_APPROVED_ROUTING_KEY);
    }

    @Bean
    Binding notificationTutorRejectedBinding(Queue notificationTutorRejectedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationTutorRejectedQueue).to(eduEventsExchange).with(TUTOR_REJECTED_ROUTING_KEY);
    }

    @Bean
    Binding notificationSubjectRequestApprovedBinding(Queue notificationSubjectRequestApprovedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationSubjectRequestApprovedQueue).to(eduEventsExchange).with(SUBJECT_REQUEST_APPROVED_ROUTING_KEY);
    }

    @Bean
    Binding notificationSubjectRequestRejectedBinding(Queue notificationSubjectRequestRejectedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationSubjectRequestRejectedQueue).to(eduEventsExchange).with(SUBJECT_REQUEST_REJECTED_ROUTING_KEY);
    }

    @Bean
    Binding notificationEnrollmentRequestedBinding(Queue notificationEnrollmentRequestedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationEnrollmentRequestedQueue).to(eduEventsExchange).with(ENROLLMENT_REQUESTED_ROUTING_KEY);
    }

    @Bean
    Binding notificationEnrollmentAcceptedBinding(Queue notificationEnrollmentAcceptedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationEnrollmentAcceptedQueue).to(eduEventsExchange).with(ENROLLMENT_ACCEPTED_ROUTING_KEY);
    }

    @Bean
    Binding notificationEnrollmentRejectedBinding(Queue notificationEnrollmentRejectedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationEnrollmentRejectedQueue).to(eduEventsExchange).with(ENROLLMENT_REJECTED_ROUTING_KEY);
    }

    @Bean
    Binding notificationEnrollmentCancelledBinding(Queue notificationEnrollmentCancelledQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(notificationEnrollmentCancelledQueue).to(eduEventsExchange).with(ENROLLMENT_CANCELLED_ROUTING_KEY);
    }

    @Bean
    Jackson2JsonMessageConverter jsonMessageConverter() {
        com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter(objectMapper);
        converter.setTypePrecedence(Jackson2JavaTypeMapper.TypePrecedence.INFERRED);
        return converter;
    }
}
