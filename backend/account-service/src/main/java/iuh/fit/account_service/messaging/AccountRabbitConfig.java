package iuh.fit.account_service.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@EnableRabbit
@Configuration
public class AccountRabbitConfig {
    public static final String EXCHANGE = "kltn.edu.events";
    public static final String TUTOR_APPLICATION_SUBMITTED_QUEUE = "account.tutor-application-submitted";
    public static final String SUBJECT_REQUEST_APPROVED_QUEUE = "account.subject-request-approved";
    public static final String SUBJECT_REQUEST_REJECTED_QUEUE = "account.subject-request-rejected";
    public static final String TUTOR_APPLICATION_SUBMITTED_ROUTING_KEY = "account.tutor-application.submitted";
    public static final String TUTOR_APPROVED_ROUTING_KEY = "account.tutor.approved";
    public static final String TUTOR_REJECTED_ROUTING_KEY = "account.tutor.rejected";
    public static final String SUBJECT_REQUEST_APPROVED_ROUTING_KEY = "learning.subject-request.approved";
    public static final String SUBJECT_REQUEST_REJECTED_ROUTING_KEY = "learning.subject-request.rejected";

    @Bean
    DirectExchange eduEventsExchange() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    Queue subjectRequestApprovedQueue() {
        return new Queue(SUBJECT_REQUEST_APPROVED_QUEUE, true);
    }

    @Bean
    Queue tutorApplicationSubmittedQueue() {
        return new Queue(TUTOR_APPLICATION_SUBMITTED_QUEUE, true);
    }

    @Bean
    Queue subjectRequestRejectedQueue() {
        return new Queue(SUBJECT_REQUEST_REJECTED_QUEUE, true);
    }

    @Bean
    Binding tutorApplicationSubmittedBinding(Queue tutorApplicationSubmittedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(tutorApplicationSubmittedQueue).to(eduEventsExchange).with(TUTOR_APPLICATION_SUBMITTED_ROUTING_KEY);
    }

    @Bean
    Binding subjectRequestApprovedBinding(Queue subjectRequestApprovedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(subjectRequestApprovedQueue).to(eduEventsExchange).with(SUBJECT_REQUEST_APPROVED_ROUTING_KEY);
    }

    @Bean
    Binding subjectRequestRejectedBinding(Queue subjectRequestRejectedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(subjectRequestRejectedQueue).to(eduEventsExchange).with(SUBJECT_REQUEST_REJECTED_ROUTING_KEY);
    }

    @Bean
    Jackson2JsonMessageConverter jsonMessageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        converter.setTypePrecedence(Jackson2JavaTypeMapper.TypePrecedence.INFERRED);
        return converter;
    }
}
