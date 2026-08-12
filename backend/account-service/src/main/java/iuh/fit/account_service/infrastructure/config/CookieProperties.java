package iuh.fit.account_service.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "auth.cookie")
public class CookieProperties {

    private String accessTokenName = "access_token";
    private String refreshTokenName = "refresh_token";
    private String csrfTokenName = "XSRF-TOKEN";
    private String path = "/";
    private String domain;
    private boolean secure = false;
    private String sameSite = "Lax";
    private long accessTokenMaxAgeSeconds = 900;
    private long refreshTokenMaxAgeSeconds = 259200;

    public String getAccessTokenName() {
        return accessTokenName;
    }

    public void setAccessTokenName(String accessTokenName) {
        this.accessTokenName = accessTokenName;
    }

    public String getRefreshTokenName() {
        return refreshTokenName;
    }

    public void setRefreshTokenName(String refreshTokenName) {
        this.refreshTokenName = refreshTokenName;
    }

    public String getCsrfTokenName() {
        return csrfTokenName;
    }

    public void setCsrfTokenName(String csrfTokenName) {
        this.csrfTokenName = csrfTokenName;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

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

    public long getAccessTokenMaxAgeSeconds() {
        return accessTokenMaxAgeSeconds;
    }

    public void setAccessTokenMaxAgeSeconds(long accessTokenMaxAgeSeconds) {
        this.accessTokenMaxAgeSeconds = accessTokenMaxAgeSeconds;
    }

    public long getRefreshTokenMaxAgeSeconds() {
        return refreshTokenMaxAgeSeconds;
    }

    public void setRefreshTokenMaxAgeSeconds(long refreshTokenMaxAgeSeconds) {
        this.refreshTokenMaxAgeSeconds = refreshTokenMaxAgeSeconds;
    }
}
