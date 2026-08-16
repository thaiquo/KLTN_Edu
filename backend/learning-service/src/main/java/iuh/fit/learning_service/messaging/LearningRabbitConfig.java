package iuh.fit.learning_service.messaging;

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
public class LearningRabbitConfig {
    public static final String EXCHANGE = "kltn.edu.events";
    public static final String TUTOR_APPROVED_QUEUE = "learning.tutor-approved";
    public static final String TUTOR_REJECTED_QUEUE = "learning.tutor-rejected";
    public static final String TUTOR_APPROVED_ROUTING_KEY = "account.tutor.approved";
    public static final String TUTOR_REJECTED_ROUTING_KEY = "account.tutor.rejected";
    public static final String SUBJECT_REQUEST_APPROVED_ROUTING_KEY = "learning.subject-request.approved";
    public static final String SUBJECT_REQUEST_REJECTED_ROUTING_KEY = "learning.subject-request.rejected";

    @Bean
    DirectExchange eduEventsExchange() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    Queue tutorApprovedQueue() {
        return new Queue(TUTOR_APPROVED_QUEUE, true);
    }

    @Bean
    Queue tutorRejectedQueue() {
        return new Queue(TUTOR_REJECTED_QUEUE, true);
    }

    @Bean
    Binding tutorApprovedBinding(Queue tutorApprovedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(tutorApprovedQueue).to(eduEventsExchange).with(TUTOR_APPROVED_ROUTING_KEY);
    }

    @Bean
    Binding tutorRejectedBinding(Queue tutorRejectedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(tutorRejectedQueue).to(eduEventsExchange).with(TUTOR_REJECTED_ROUTING_KEY);
    }

    @Bean
    Jackson2JsonMessageConverter jsonMessageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        converter.setTypePrecedence(Jackson2JavaTypeMapper.TypePrecedence.INFERRED);
        return converter;
    }
}
