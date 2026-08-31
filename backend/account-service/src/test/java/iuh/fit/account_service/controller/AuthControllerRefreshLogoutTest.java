package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.auth.LoginResult;
import iuh.fit.account_service.dto.auth.ResetPasswordRequest;
import iuh.fit.account_service.service.AuthCookieService;
import iuh.fit.account_service.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthControllerRefreshLogoutTest {

    private final AuthService authService = mock(AuthService.class);
    private final AuthCookieService authCookieService = mock(AuthCookieService.class);
    private final AuthController controller = new AuthController(authService, authCookieService);

    @Test
    void refreshReadsRefreshCookieAndSetsRotatedCookies() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("refresh_token", "old-refresh-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(authService.refresh("old-refresh-token")).thenReturn(new LoginResult(
                1L,
                "student@example.com",
                "Student User",
                List.of("STUDENT"),
                "STUDENT",
                true,
                false,
                null,
                "new-access-token",
                "new-refresh-token"
        ));

        var entity = controller.refresh(request, response);

        assertThat(entity.getBody()).isNotNull();
        assertThat(entity.getBody().getActiveRole()).isEqualTo("STUDENT");
        verify(authCookieService).addAccessTokenCookie(response, "new-access-token");
        verify(authCookieService).addRefreshTokenCookie(response, "new-refresh-token");
    }

    @Test
    void logoutRevokesRefreshSessionAndClearsBothCookies() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("refresh_token", "refresh-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        var entity = controller.logout(request, response);

        assertThat(entity.getStatusCode().value()).isEqualTo(204);
        verify(authService).logout("refresh-token");
        verify(authCookieService).clearAuthCookies(response);
    }

    @Test
    void resetPasswordClearsAuthCookiesAfterSuccessfulReset() {
        ResetPasswordRequest request = new ResetPasswordRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        controller.resetPassword(request, response);

        verify(authService).resetPassword(request);
        verify(authCookieService).clearAuthCookies(response);
    }
}
