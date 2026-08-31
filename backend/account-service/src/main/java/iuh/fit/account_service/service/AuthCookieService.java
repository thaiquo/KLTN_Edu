package iuh.fit.account_service.service;

import iuh.fit.account_service.config.AuthCookieProperties;
import iuh.fit.account_service.config.security.JwtService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;

@Service
public class AuthCookieService {

    public static final String ACCESS_TOKEN_COOKIE = "access_token";
    public static final String REFRESH_TOKEN_COOKIE = "refresh_token";

    private final AuthCookieProperties properties;
    private final JwtService jwtService;

    public AuthCookieService(AuthCookieProperties properties, JwtService jwtService) {
        this.properties = properties;
        this.jwtService = jwtService;
    }

    public void addAccessTokenCookie(HttpServletResponse response, String token) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(
                ACCESS_TOKEN_COOKIE,
                token,
                properties.getAccessTokenPath(),
                Duration.ofMillis(jwtService.getExpirationMillis())
        ).toString());
    }

    public void addRefreshTokenCookie(HttpServletResponse response, String token) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(
                REFRESH_TOKEN_COOKIE,
                token,
                properties.getRefreshTokenPath(),
                properties.getRefreshTokenMaxAge()
        ).toString());
    }

    public void clearAuthCookies(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, clearCookie(
                ACCESS_TOKEN_COOKIE,
                properties.getAccessTokenPath()
        ).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, clearCookie(
                REFRESH_TOKEN_COOKIE,
                properties.getRefreshTokenPath()
        ).toString());
    }

    private ResponseCookie buildCookie(String name, String value, String path, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(properties.isSecure())
                .sameSite(properties.getSameSite())
                .path(path)
                .maxAge(maxAge)
                .build();
    }

    private ResponseCookie clearCookie(String name, String path) {
        return ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(properties.isSecure())
                .sameSite(properties.getSameSite())
                .path(path)
                .maxAge(Duration.ZERO)
                .build();
    }
}
