package iuh.fit.api_gateway.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "security.login-rate-limit")
public class LoginRateLimitProperties {
    private boolean enabled = true;
    private int requests = 20;
    private Duration window = Duration.ofMinutes(1);
    private List<String> trustedProxyCidrs = new ArrayList<>();

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getRequests() { return requests; }
    public void setRequests(int requests) { this.requests = requests; }
    public Duration getWindow() { return window; }
    public void setWindow(Duration window) { this.window = window; }
    public List<String> getTrustedProxyCidrs() { return trustedProxyCidrs; }
    public void setTrustedProxyCidrs(List<String> trustedProxyCidrs) {
        this.trustedProxyCidrs = trustedProxyCidrs == null ? new ArrayList<>() : trustedProxyCidrs;
    }
}
