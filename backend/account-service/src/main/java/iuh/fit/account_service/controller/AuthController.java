package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.auth.LoginRequest;
import iuh.fit.account_service.dto.auth.LoginResponse;
import iuh.fit.account_service.dto.auth.LoginResult;
import iuh.fit.account_service.dto.auth.ForgotPasswordRequest;
import iuh.fit.account_service.dto.auth.RegisterRequest;
import iuh.fit.account_service.dto.auth.RegisterResponse;
import iuh.fit.account_service.dto.auth.ResendVerificationOtpRequest;
import iuh.fit.account_service.dto.auth.ResetPasswordRequest;
import iuh.fit.account_service.dto.auth.SwitchRoleRequest;
import iuh.fit.account_service.dto.auth.VerifyEmailRequest;
import iuh.fit.account_service.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = authService.register(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PostMapping("/verify-email")
    public ResponseEntity<String> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request);

        return ResponseEntity.ok("Email verified successfully");
    }

    @PostMapping("/resend-verification-otp")
    public ResponseEntity<String> resendVerificationOtp(
            @Valid @RequestBody ResendVerificationOtpRequest request) {
        authService.resendVerificationOtp(request);

        return ResponseEntity.ok("If the email exists and is not verified, a new OTP has been sent.");
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);

        return ResponseEntity.ok("If the email exists, a password reset OTP has been sent.");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);

        return ResponseEntity.ok("Password has been reset successfully.");
    }

    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken csrfToken) {
        csrfToken.getToken();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        LoginResult result = authService.login(request);

        ResponseCookie cookie = ResponseCookie
                .from("access_token", result.getToken())
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofDays(1))
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return ResponseEntity.ok(
                new LoginResponse(
                        result.getUserId(),
                        result.getEmail(),
                        result.getFullName(),
                        result.getRoles(),
                        result.getActiveRole(),
                        result.isHasStudentProfile(),
                        result.isHasTutorProfile(),
                        result.getTutorStatus()));
    }

    @PostMapping("/switch-role")
    public ResponseEntity<LoginResponse> switchRole(
            @Valid @RequestBody SwitchRoleRequest request,
            Authentication authentication,
            HttpServletResponse response) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        LoginResult result = authService.switchRole(authentication.getName(), request);

        ResponseCookie cookie = ResponseCookie
                .from("access_token", result.getToken())
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofDays(1))
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return ResponseEntity.ok(
                new LoginResponse(
                        result.getUserId(),
                        result.getEmail(),
                        result.getFullName(),
                        result.getRoles(),
                        result.getActiveRole(),
                        result.isHasStudentProfile(),
                        result.isHasTutorProfile(),
                        result.getTutorStatus()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie
                .from("access_token", "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return ResponseEntity.noContent().build();
    }
}
