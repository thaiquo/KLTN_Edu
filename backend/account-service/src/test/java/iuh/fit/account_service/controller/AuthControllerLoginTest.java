package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.auth.LoginRequest;
import iuh.fit.account_service.dto.auth.LoginResult;
import iuh.fit.account_service.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthControllerLoginTest {

    @Test
    void loginSetsAccessTokenCookieAndReturnsMultipleRolesWithoutTokenBody() {
        AuthService authService = mock(AuthService.class);
        AuthController controller = new AuthController(authService);
        LoginRequest request = new LoginRequest();
        request.setEmail("test@gmail.com");
        request.setPassword("12345678");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(authService.login(request)).thenReturn(new LoginResult(
                1L,
                "test@gmail.com",
                "Test User",
                List.of("STUDENT", "TUTOR"),
                "jwt-token"
        ));

        var entity = controller.login(request, response);

        assertThat(entity.getBody()).isNotNull();
        assertThat(entity.getBody().getRoles()).containsExactly("STUDENT", "TUTOR");
        assertThat(response.getHeader(HttpHeaders.SET_COOKIE)).contains("access_token=jwt-token");
        Cookie cookie = response.getCookie("access_token");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(entity.getBody().getClass().getDeclaredFields())
                .extracting(java.lang.reflect.Field::getName)
                .doesNotContain("token");
    }
}
