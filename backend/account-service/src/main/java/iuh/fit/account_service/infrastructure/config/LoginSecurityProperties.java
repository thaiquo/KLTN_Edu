package iuh.fit.account_service.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "auth.security.login")
public class LoginSecurityProperties {

    private int maxAttempts = 5;
    private int windowMinutes = 10;
    private int blockMinutes = 15;

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public int getWindowMinutes() {
        return windowMinutes;
    }

    public void setWindowMinutes(int windowMinutes) {
        this.windowMinutes = windowMinutes;
    }

    public int getBlockMinutes() {
        return blockMinutes;
    }

    public void setBlockMinutes(int blockMinutes) {
        this.blockMinutes = blockMinutes;
    }
}