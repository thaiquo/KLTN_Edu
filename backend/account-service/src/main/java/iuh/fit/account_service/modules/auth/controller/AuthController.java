package iuh.fit.account_service.modules.auth.controller;

import iuh.fit.account_service.infrastructure.config.CookieProperties;
import iuh.fit.account_service.infrastructure.security.AuthPrincipal;
import iuh.fit.account_service.modules.auth.dto.request.ChangePasswordRequest;
import iuh.fit.account_service.modules.auth.dto.request.ForgotPasswordRequest;
import iuh.fit.account_service.modules.auth.dto.request.LoginRequest;
import iuh.fit.account_service.modules.auth.dto.request.RegisterRequest;
import iuh.fit.account_service.modules.auth.dto.request.ResetPasswordRequest;
import iuh.fit.account_service.modules.auth.dto.request.UpdateProfileRequest;
import iuh.fit.account_service.modules.auth.dto.response.AccountResponse;
import iuh.fit.account_service.modules.auth.dto.response.AuthResponseBody;
import iuh.fit.account_service.modules.auth.dto.response.MessageResponse;
import iuh.fit.account_service.modules.auth.dto.response.SessionResponse;
import iuh.fit.account_service.modules.auth.service.AuthService;
import iuh.fit.account_service.shared.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping
public class AuthController {

    private final AuthService authService;
    private final CookieProperties cookieProperties;

    public AuthController(AuthService authService, CookieProperties cookieProperties) {
        this.authService = authService;
        this.cookieProperties = cookieProperties;
    }

    @PostMapping("/auth/register")
    public ApiResponse<AuthResponseBody> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success(authService.register(request));
    }

    @PostMapping("/auth/login")
    public ApiResponse<AuthResponseBody> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletRequest httpRequest,
                                               HttpServletResponse response) {
        return ApiResponse.success(authService.login(request, response, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/auth/refresh")
    public ApiResponse<AuthResponseBody> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = getCookieValue(request, cookieProperties.getRefreshTokenName());
        return ApiResponse.success(authService.refresh(refreshToken, response));
    }

    @PostMapping("/auth/logout")
    public ApiResponse<MessageResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = getCookieValue(request, cookieProperties.getRefreshTokenName());
        return ApiResponse.success(authService.logout(refreshToken, response));
    }

    @PostMapping("/auth/forgot-password")
    public ApiResponse<MessageResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ApiResponse.success(authService.forgotPassword(request));
    }

    @PostMapping("/auth/reset-password")
    public ApiResponse<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ApiResponse.success(authService.resetPassword(request));
    }

    @PostMapping("/auth/verify-email")
    public ApiResponse<MessageResponse> verifyEmail(@RequestBody Map<String, String> request) {
        return ApiResponse.success(authService.verifyEmail(request.get("token")));
    }

    @GetMapping("/auth/csrf")
    public ApiResponse<Map<String, String>> csrf(CsrfToken csrfToken) {
        return ApiResponse.success(Map.of("token", csrfToken.getToken(), "headerName", csrfToken.getHeaderName(), "parameterName", csrfToken.getParameterName()));
    }

    @GetMapping("/me")
    public ApiResponse<AccountResponse> me(@AuthenticationPrincipal AuthPrincipal principal) {
        return ApiResponse.success(authService.getCurrentAccount(principal));
    }

    @PutMapping("/me")
    public ApiResponse<AccountResponse> updateMe(@AuthenticationPrincipal AuthPrincipal principal,
                                                 @Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.success(authService.updateProfile(principal, request));
    }

    @PutMapping("/me/password")
    public ApiResponse<MessageResponse> changePassword(@AuthenticationPrincipal AuthPrincipal principal,
                                                       @Valid @RequestBody ChangePasswordRequest request) {
        return ApiResponse.success(authService.changePassword(principal, request));
    }

    @GetMapping("/auth/me/sessions")
    public ApiResponse<Page<SessionResponse>> sessions(@AuthenticationPrincipal AuthPrincipal principal, Pageable pageable) {
        return ApiResponse.success(authService.listSessions(principal, pageable));
    }

    @DeleteMapping("/auth/me/sessions/{id}")
    public ApiResponse<MessageResponse> revokeSession(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id) {
        return ApiResponse.success(authService.revokeSession(principal, id));
    }

    @PostMapping("/auth/logout-all")
    public ApiResponse<MessageResponse> logoutAll(@AuthenticationPrincipal AuthPrincipal principal, HttpServletResponse response) {
        return ApiResponse.success(authService.logoutAll(principal, response));
    }

    private String getCookieValue(HttpServletRequest request, String cookieName) {
        if (request.getCookies() == null) {
            return null;
        }
        for (var cookie : request.getCookies()) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
