package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.ForgotPasswordRequest;
import iuh.fit.account_service.dto.auth.ResetPasswordRequest;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServicePasswordResetTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final OtpService otpService = mock(OtpService.class);
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private AuthService authService;
    private User user;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                userRoleRepository,
                mock(OtpVerificationRepository.class),
                mock(TutorRepository.class),
                passwordEncoder,
                otpService,
                mock(AuthenticationManager.class),
                mock(JwtService.class)
        );

        user = new User();
        ReflectionTestUtils.setField(user, "id", 30L);
        user.setEmail("test@example.com");
        user.setPassword(passwordEncoder.encode("oldPassword123"));
        user.setFullName("Test User");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);
    }

    @Test
    void forgotPasswordExistingVerifiedUserGeneratesPasswordResetOtp() {
        ForgotPasswordRequest request = forgotRequest(" TEST@example.com ");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        authService.forgotPassword(request);

        verify(otpService).generateAndSendPasswordResetOtpIfAllowed(user);
    }

    @Test
    void forgotPasswordUnknownEmailIsNeutral() {
        ForgotPasswordRequest request = forgotRequest("unknown@example.com");
        when(userRepository.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());

        authService.forgotPassword(request);

        verify(otpService, never()).generateAndSendPasswordResetOtpIfAllowed(org.mockito.Mockito.any(User.class));
    }

    @Test
    void forgotPasswordUnverifiedUserIsNeutralAndDoesNotSendOtp() {
        user.setEmailVerified(false);
        ForgotPasswordRequest request = forgotRequest("test@example.com");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        authService.forgotPassword(request);

        verify(otpService, never()).generateAndSendPasswordResetOtpIfAllowed(user);
    }

    @Test
    void resetPasswordSuccessEncodesPasswordAndConsumesPasswordResetOtp() {
        ResetPasswordRequest request = resetRequest("test@example.com", "123456", "newPassword123", "newPassword123");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        authService.resetPassword(request);

        verify(otpService).verifyPasswordResetOtp(user, "123456");
        verify(userRepository).save(user);
        assertThat(passwordEncoder.matches("newPassword123", user.getPassword())).isTrue();
        assertThat(passwordEncoder.matches("oldPassword123", user.getPassword())).isFalse();
    }

    @Test
    void resetPasswordMismatchReturnsBadRequest() {
        ResetPasswordRequest request = resetRequest("test@example.com", "123456", "newPassword123", "different123");

        assertThatThrownBy(() -> authService.resetPassword(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Passwords do not match");

        verify(otpService, never()).verifyPasswordResetOtp(org.mockito.Mockito.any(User.class), org.mockito.Mockito.anyString());
    }

    @Test
    void resetPasswordDoesNotChangeRoles() {
        ResetPasswordRequest request = resetRequest("test@example.com", "123456", "newPassword123", "newPassword123");
        UserRole student = role(user, Role.STUDENT);
        UserRole tutor = role(user, Role.TUTOR);
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(30L)).thenReturn(List.of(student, tutor));

        authService.resetPassword(request);

        assertThat(userRoleRepository.findByUserId(30L))
                .extracting(UserRole::getRole)
                .containsExactly(Role.STUDENT, Role.TUTOR);
    }

    @Test
    void resetPasswordDoesNotChangeAccountStatus() {
        user.setAccountStatus(AccountStatus.LOCKED);
        ResetPasswordRequest request = resetRequest("test@example.com", "123456", "newPassword123", "newPassword123");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        authService.resetPassword(request);

        assertThat(user.getAccountStatus()).isEqualTo(AccountStatus.LOCKED);
    }

    private ForgotPasswordRequest forgotRequest(String email) {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(email);
        return request;
    }

    private ResetPasswordRequest resetRequest(String email, String otp, String password, String confirmPassword) {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setEmail(email);
        request.setOtp(otp);
        request.setNewPassword(password);
        request.setConfirmPassword(confirmPassword);
        return request;
    }

    private UserRole role(User user, Role role) {
        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        return userRole;
    }
}
