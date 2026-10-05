package iuh.fit.contract_service.config;

import org.springframework.amqp.core.DirectExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ContractRabbitConfig {
    public static final String EVENTS_EXCHANGE = "kltn.edu.events";

    @Bean
    DirectExchange contractEventsExchange() {
        return new DirectExchange(EVENTS_EXCHANGE, true, false);
    }
}
