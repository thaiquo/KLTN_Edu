package iuh.fit.account_service.service;

import iuh.fit.account_service.config.AuthCookieProperties;
import iuh.fit.account_service.config.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthCookieServiceTest {

    @Test
    void localCookieDefaultsAreHttpOnlyLaxAndNotSecure() {
        JwtService jwtService = mock(JwtService.class);
        when(jwtService.getExpirationMillis()).thenReturn(900000L);
        AuthCookieService service = new AuthCookieService(new AuthCookieProperties(), jwtService);
        MockHttpServletResponse response = new MockHttpServletResponse();

        service.addAccessTokenCookie(response, "access-token");
        service.addRefreshTokenCookie(response, "refresh-token");

        assertThat(response.getHeaders(HttpHeaders.SET_COOKIE)).anySatisfy(header -> {
            assertThat(header).contains("access_token=access-token");
            assertThat(header).contains("HttpOnly");
            assertThat(header).contains("SameSite=Lax");
            assertThat(header).doesNotContain("Secure");
            assertThat(header).contains("Max-Age=900");
        });
        assertThat(response.getHeaders(HttpHeaders.SET_COOKIE)).anySatisfy(header -> {
            assertThat(header).contains("refresh_token=refresh-token");
            assertThat(header).contains("Path=/api/auth");
            assertThat(header).contains("Max-Age=604800");
        });
    }

    @Test
    void secureCookieCanBeEnabledForHttpsDeployment() {
        AuthCookieProperties properties = new AuthCookieProperties();
        properties.setSecure(true);
        JwtService jwtService = mock(JwtService.class);
        when(jwtService.getExpirationMillis()).thenReturn(900000L);
        AuthCookieService service = new AuthCookieService(properties, jwtService);
        MockHttpServletResponse response = new MockHttpServletResponse();

        service.addAccessTokenCookie(response, "access-token");

        assertThat(response.getHeader(HttpHeaders.SET_COOKIE)).contains("Secure");
    }
}
