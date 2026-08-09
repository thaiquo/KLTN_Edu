package iuh.fit.authservice.infrastructure.config;

import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseCookie.ResponseCookieBuilder;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class CookieService {

    private final CookieProperties properties;

    public CookieService(CookieProperties properties) {
        this.properties = properties;
    }

    public ResponseCookie createAccessTokenCookie(String token) {
        return build(properties.getAccessTokenName(), token, Duration.ofSeconds(properties.getAccessTokenMaxAgeSeconds()), true);
    }

    public ResponseCookie createRefreshTokenCookie(String token) {
        return build(properties.getRefreshTokenName(), token, Duration.ofSeconds(properties.getRefreshTokenMaxAgeSeconds()), true);
    }

    public ResponseCookie clearAccessTokenCookie() {
        return delete(properties.getAccessTokenName());
    }

    public ResponseCookie clearRefreshTokenCookie() {
        return delete(properties.getRefreshTokenName());
    }

    public ResponseCookie clearCsrfCookie() {
        return delete(properties.getCsrfTokenName());
    }

    private ResponseCookie build(String name, String value, Duration maxAge, boolean httpOnly) {
        ResponseCookieBuilder builder = ResponseCookie.from(name, value)
            .path(properties.getPath())
            .httpOnly(httpOnly)
            .secure(properties.isSecure())
            .sameSite(properties.getSameSite())
            .maxAge(maxAge);
        if (properties.getDomain() != null && !properties.getDomain().isBlank()) {
            builder.domain(properties.getDomain());
        }
        return builder.build();
    }

    private ResponseCookie delete(String name) {
        ResponseCookieBuilder builder = ResponseCookie.from(name, "")
            .path(properties.getPath())
            .httpOnly(true)
            .secure(properties.isSecure())
            .sameSite(properties.getSameSite())
            .maxAge(0);
        if (properties.getDomain() != null && !properties.getDomain().isBlank()) {
            builder.domain(properties.getDomain());
        }
        return builder.build();
    }
}