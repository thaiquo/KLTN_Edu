package iuh.fit.learning_service.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
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
    public static final String ENROLLMENT_REQUESTED_ROUTING_KEY = "learning.enrollment.requested";
    public static final String ENROLLMENT_ACCEPTED_ROUTING_KEY = "learning.enrollment.accepted";
    public static final String ENROLLMENT_REJECTED_ROUTING_KEY = "learning.enrollment.rejected";
    public static final String ENROLLMENT_CANCELLED_ROUTING_KEY = "learning.enrollment.cancelled";
    public static final String CLASS_REVIEWED_ROUTING_KEY = "learning.class.reviewed";
    public static final String TEACHING_REGISTRATION_REVIEWED_ROUTING_KEY = "learning.teaching-registration.reviewed";

    public static final String CONTRACT_ACTIVATED_QUEUE = "learning.contract-activated";
    public static final String CONTRACT_EXPIRED_QUEUE = "learning.contract-expired";
    public static final String CONTRACT_ACTIVATED_ROUTING_KEY = "contract.activated.v1";
    public static final String CONTRACT_EXPIRED_ROUTING_KEY = "contract.expired.v1";

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
    Queue contractActivatedQueue() {
        return new Queue(CONTRACT_ACTIVATED_QUEUE, true);
    }

    @Bean
    Queue contractExpiredQueue() {
        return new Queue(CONTRACT_EXPIRED_QUEUE, true);
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
    Binding contractActivatedBinding(Queue contractActivatedQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(contractActivatedQueue).to(eduEventsExchange).with(CONTRACT_ACTIVATED_ROUTING_KEY);
    }

    @Bean
    Binding contractExpiredBinding(Queue contractExpiredQueue, DirectExchange eduEventsExchange) {
        return BindingBuilder.bind(contractExpiredQueue).to(eduEventsExchange).with(CONTRACT_EXPIRED_ROUTING_KEY);
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
