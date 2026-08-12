package iuh.fit.account_service.infrastructure.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CookieServiceTest {

    @Test
    void shouldCreateSecureHttpOnlyCookieWithConfiguredName() {
        CookieProperties properties = new CookieProperties();
        properties.setAccessTokenName("access_token");
        properties.setRefreshTokenName("refresh_token");
        properties.setCsrfTokenName("XSRF-TOKEN");
        properties.setSecure(true);
        properties.setSameSite("Lax");
        properties.setPath("/");
        properties.setAccessTokenMaxAgeSeconds(900);

        CookieService cookieService = new CookieService(properties);

        var cookie = cookieService.createAccessTokenCookie("token-value");

        assertThat(cookie.getName()).isEqualTo("access_token");
        assertThat(cookie.getValue()).isEqualTo("token-value");
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        assertThat(cookie.getPath()).isEqualTo("/");
        assertThat(cookie.getMaxAge().getSeconds()).isEqualTo(900);
    }
}