package iuh.fit.contract_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "escrow.trial")
public record EscrowTrialProperties(boolean enabled, Duration fundingConfirmationSafetyMargin) {
    public EscrowTrialProperties {
        if (fundingConfirmationSafetyMargin == null
                || fundingConfirmationSafetyMargin.isZero()
                || fundingConfirmationSafetyMargin.isNegative()) {
            fundingConfirmationSafetyMargin = Duration.ofMinutes(30);
        }
    }
}
