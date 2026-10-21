package iuh.fit.account_service.controller;

import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.LoginRequest;
import iuh.fit.account_service.dto.auth.LoginResult;
import iuh.fit.account_service.dto.auth.SwitchRoleRequest;
import iuh.fit.account_service.dto.auth.RegisterRequest;
import iuh.fit.account_service.dto.auth.VerifyEmailRequest;
import iuh.fit.account_service.dto.auth.ResendVerificationOtpRequest;
import iuh.fit.account_service.dto.auth.ForgotPasswordRequest;
import iuh.fit.account_service.dto.auth.ResetPasswordRequest;
import iuh.fit.account_service.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class MobileAuthControllerTest {
    private final AuthService auth = mock(AuthService.class);
    private final JwtService jwt = mock(JwtService.class);
    private final MobileAuthController controller = new MobileAuthController(auth, jwt);

    @Test
    void loginReturnsTokensWithoutChangingWebControllerContract() {
        LoginRequest request = new LoginRequest();
        request.setEmail("student@example.com");
        request.setPassword("password");
        when(jwt.getExpirationMillis()).thenReturn(900000L);
        when(auth.login(request)).thenReturn(result("STUDENT", "access", "refresh"));

        var response = controller.login(request);

        assertThat(response.accessToken()).isEqualTo("access");
        assertThat(response.refreshToken()).isEqualTo("refresh");
        assertThat(response.expiresInSeconds()).isEqualTo(900);
    }

    @Test
    void refreshAndRoleSwitchUseExistingAuthServiceSessionSemantics() {
        when(auth.refresh("old")).thenReturn(result("STUDENT", "new-access", "new-refresh"));
        assertThat(controller.refresh(new MobileAuthController.RefreshRequest("old")).refreshToken())
                .isEqualTo("new-refresh");

        SwitchRoleRequest role = new SwitchRoleRequest();
        role.setTargetRole("TUTOR");
        when(auth.switchRoleMobile("student@example.com", role, "new-refresh"))
                .thenReturn(result("TUTOR", "tutor-access", null));
        var response = controller.switchRole(role,
                new UsernamePasswordAuthenticationToken("student@example.com", null), "new-refresh");
        assertThat(response.getBody().activeRole()).isEqualTo("TUTOR");
        assertThat(response.getBody().accessToken()).isEqualTo("tutor-access");
        assertThat(response.getBody().refreshToken()).isNull();
    }

    @Test
    void logoutRevokesSuppliedSession() {
        controller.logout(new MobileAuthController.RefreshRequest("refresh"));
        verify(auth).logout("refresh");
    }

    @Test
    void publicMobileAuthRoutesDelegateToExistingAuthService() {
        RegisterRequest register = new RegisterRequest();
        VerifyEmailRequest verifyRequest = new VerifyEmailRequest();
        ResendVerificationOtpRequest resend = new ResendVerificationOtpRequest();
        ForgotPasswordRequest forgot = new ForgotPasswordRequest();
        ResetPasswordRequest reset = new ResetPasswordRequest();

        assertThat(controller.register(register).getStatusCode().value()).isEqualTo(201);
        assertThat(controller.verifyEmail(verifyRequest).getStatusCode().value()).isEqualTo(204);
        assertThat(controller.resendVerificationOtp(resend).getStatusCode().value()).isEqualTo(204);
        assertThat(controller.forgotPassword(forgot).getStatusCode().value()).isEqualTo(204);
        assertThat(controller.resetPassword(reset).getStatusCode().value()).isEqualTo(204);
        verify(auth).register(register);
        verify(auth).verifyEmail(verifyRequest);
        verify(auth).resendVerificationOtp(resend);
        verify(auth).forgotPassword(forgot);
        verify(auth).resetPassword(reset);
    }

    private LoginResult result(String role, String access, String refresh) {
        return new LoginResult(1L, "student@example.com", "Student", List.of("STUDENT", "TUTOR"), role,
                true, true, "APPROVED", access, refresh);
    }
}
