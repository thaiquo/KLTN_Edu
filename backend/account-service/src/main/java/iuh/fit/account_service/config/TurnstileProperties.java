package iuh.fit.account_service.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "app.auth.turnstile")
public class TurnstileProperties {
    public static final String PASSING_TEST_SECRET = "1x0000000000000000000000000000000AA";

    private final String environment;
    private boolean enabled = true;
    private String secretKey;
    private String siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    private String expectedAction = "login";
    private List<String> allowedHostnames = new ArrayList<>();
    private Duration connectTimeout = Duration.ofSeconds(3);
    private Duration readTimeout = Duration.ofSeconds(5);

    public TurnstileProperties(@Value("${app.env:dev}") String environment) {
        this.environment = environment;
    }

    @PostConstruct
    void validate() {
        if (!enabled) return;
        if (secretKey == null || secretKey.isBlank()) {
            if (isProduction()) throw new IllegalStateException("TURNSTILE_SECRET_KEY is required in production");
            secretKey = PASSING_TEST_SECRET;
        }
        if (isProduction() && secretKey.equals(PASSING_TEST_SECRET)) {
            throw new IllegalStateException("Cloudflare Turnstile test keys are forbidden in production");
        }
        if (isProduction() && allowedHostnames.isEmpty()) {
            throw new IllegalStateException("TURNSTILE_ALLOWED_HOSTNAMES is required in production");
        }
    }

    public boolean usesTestKey() { return PASSING_TEST_SECRET.equals(secretKey); }
    private boolean isProduction() { return "production".equalsIgnoreCase(environment) || "prod".equalsIgnoreCase(environment); }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
    public String getSiteverifyUrl() { return siteverifyUrl; }
    public void setSiteverifyUrl(String siteverifyUrl) { this.siteverifyUrl = siteverifyUrl; }
    public String getExpectedAction() { return expectedAction; }
    public void setExpectedAction(String expectedAction) { this.expectedAction = expectedAction; }
    public List<String> getAllowedHostnames() { return allowedHostnames; }
    public void setAllowedHostnames(List<String> allowedHostnames) { this.allowedHostnames = allowedHostnames == null ? new ArrayList<>() : allowedHostnames; }
    public Duration getConnectTimeout() { return connectTimeout; }
    public void setConnectTimeout(Duration connectTimeout) { this.connectTimeout = connectTimeout; }
    public Duration getReadTimeout() { return readTimeout; }
    public void setReadTimeout(Duration readTimeout) { this.readTimeout = readTimeout; }
}
