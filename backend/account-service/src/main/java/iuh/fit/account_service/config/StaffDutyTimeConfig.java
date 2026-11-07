package iuh.fit.account_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class StaffDutyTimeConfig {
    public static final ZoneId DUTY_ZONE = ZoneId.of("Asia/Bangkok");

    @Bean
    public Clock staffDutyClock() {
        return Clock.system(DUTY_ZONE);
    }
}
