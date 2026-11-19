package iuh.fit.account_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@ConfigurationProperties(prefix = "app.auth.login-protection")
public class LoginProtectionProperties {
    private boolean enabled = true;
    private int failureThreshold = 3;
    private Duration failureWindow = Duration.ofMinutes(10);
    private Duration lockDuration = Duration.ofSeconds(10);

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getFailureThreshold() { return failureThreshold; }
    public void setFailureThreshold(int failureThreshold) { this.failureThreshold = failureThreshold; }
    public Duration getFailureWindow() { return failureWindow; }
    public void setFailureWindow(Duration failureWindow) { this.failureWindow = failureWindow; }
    public Duration getLockDuration() { return lockDuration; }
    public void setLockDuration(Duration lockDuration) { this.lockDuration = lockDuration; }
}
