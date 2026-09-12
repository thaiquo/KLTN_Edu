package iuh.fit.contract_service.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class SettlementClockConfiguration {
    @Bean
    Clock settlementClock() { return Clock.systemUTC(); }
}
