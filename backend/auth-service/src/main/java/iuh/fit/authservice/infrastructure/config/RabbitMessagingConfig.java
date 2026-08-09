package iuh.fit.authservice.infrastructure.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMessagingConfig {

    private static final String EXCHANGE_NAME = "auth.outbox.exchange";
    private static final String QUEUE_NAME = "auth.outbox.queue";

    @Bean
    public FanoutExchange authOutboxExchange() {
        return new FanoutExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Queue authOutboxQueue() {
        return new Queue(QUEUE_NAME, true);
    }

    @Bean
    public Binding authOutboxBinding(FanoutExchange authOutboxExchange, Queue authOutboxQueue) {
        return BindingBuilder.bind(authOutboxQueue).to(authOutboxExchange);
    }
}