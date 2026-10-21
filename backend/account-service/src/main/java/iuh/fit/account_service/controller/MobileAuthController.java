package iuh.fit.account_service.controller;

import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.LoginRequest;
import iuh.fit.account_service.dto.auth.RegisterRequest;
import iuh.fit.account_service.dto.auth.RegisterResponse;
import iuh.fit.account_service.dto.auth.VerifyEmailRequest;
import iuh.fit.account_service.dto.auth.ResendVerificationOtpRequest;
import iuh.fit.account_service.dto.auth.ForgotPasswordRequest;
import iuh.fit.account_service.dto.auth.ResetPasswordRequest;
import iuh.fit.account_service.dto.auth.MobileSessionResponse;
import iuh.fit.account_service.dto.auth.SwitchRoleRequest;
import iuh.fit.account_service.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/mobile")
public class MobileAuthController {
    private final AuthService authService;
    private final JwtService jwtService;

    public MobileAuthController(AuthService authService, JwtService jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }

    public record RefreshRequest(String refreshToken) {}

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/resend-verification-otp")
    public ResponseEntity<Void> resendVerificationOtp(@Valid @RequestBody ResendVerificationOtpRequest request) {
        authService.resendVerificationOtp(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    public MobileSessionResponse login(@Valid @RequestBody LoginRequest request) {
        return response(authService.login(request));
    }

    @PostMapping("/refresh")
    public MobileSessionResponse refresh(@RequestBody RefreshRequest request) {
        return response(authService.refresh(request.refreshToken()));
    }

    @PostMapping("/switch-role")
    public ResponseEntity<MobileSessionResponse> switchRole(@Valid @RequestBody SwitchRoleRequest request,
                                                             Authentication authentication,
                                                             @org.springframework.web.bind.annotation.RequestHeader("X-Mobile-Refresh-Token") String refreshToken) {
        if (authentication == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(response(authService.switchRoleMobile(authentication.getName(), request, refreshToken)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody RefreshRequest request) {
        authService.logout(request.refreshToken());
        return ResponseEntity.noContent().build();
    }

    private MobileSessionResponse response(iuh.fit.account_service.dto.auth.LoginResult result) {
        return MobileSessionResponse.from(result, jwtService.getExpirationMillis());
    }
}
