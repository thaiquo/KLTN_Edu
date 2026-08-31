package iuh.fit.account_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@ConfigurationProperties(prefix = "app.auth.cookie")
public class AuthCookieProperties {

    private boolean secure = false;
    private String sameSite = "Lax";
    private String accessTokenPath = "/";
    private String refreshTokenPath = "/api/auth";
    private Duration refreshTokenMaxAge = Duration.ofDays(7);

    public boolean isSecure() {
        return secure;
    }

    public void setSecure(boolean secure) {
        this.secure = secure;
    }

    public String getSameSite() {
        return sameSite;
    }

    public void setSameSite(String sameSite) {
        this.sameSite = sameSite;
    }

    public String getAccessTokenPath() {
        return accessTokenPath;
    }

    public void setAccessTokenPath(String accessTokenPath) {
        this.accessTokenPath = accessTokenPath;
    }

    public String getRefreshTokenPath() {
        return refreshTokenPath;
    }

    public void setRefreshTokenPath(String refreshTokenPath) {
        this.refreshTokenPath = refreshTokenPath;
    }

    public Duration getRefreshTokenMaxAge() {
        return refreshTokenMaxAge;
    }

    public void setRefreshTokenMaxAge(Duration refreshTokenMaxAge) {
        this.refreshTokenMaxAge = refreshTokenMaxAge;
    }
}
