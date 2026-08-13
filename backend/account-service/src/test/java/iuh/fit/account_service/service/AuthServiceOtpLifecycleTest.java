package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.ResendVerificationOtpRequest;
import iuh.fit.account_service.dto.auth.VerifyEmailRequest;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceOtpLifecycleTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final OtpService otpService = mock(OtpService.class);
    private AuthService authService;
    private User user;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                mock(UserRoleRepository.class),
                mock(OtpVerificationRepository.class),
                mock(TutorRepository.class),
                mock(PasswordEncoder.class),
                otpService,
                mock(AuthenticationManager.class),
                mock(JwtService.class)
        );

        user = new User();
        ReflectionTestUtils.setField(user, "id", 20L);
        user.setEmail("test@example.com");
        user.setEmailVerified(false);
    }

    @Test
    void verifyEmailNormalizesEmailMarksUserVerifiedAndDelegatesOtpVerification() {
        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail("  TEST@Example.COM  ");
        request.setOtp("123456");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        authService.verifyEmail(request);

        verify(otpService).verifyEmailOtp(user, "123456");
        assertThat(user.isEmailVerified()).isTrue();
        verify(userRepository).save(user);
    }

    @Test
    void resendForUnverifiedUserDelegatesOtpResend() {
        ResendVerificationOtpRequest request = new ResendVerificationOtpRequest();
        request.setEmail(" TEST@example.com ");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        authService.resendVerificationOtp(request);

        verify(otpService).resendEmailVerificationOtp(user);
    }

    @Test
    void resendForVerifiedAccountDoesNotGenerateNewOtp() {
        user.setEmailVerified(true);
        ResendVerificationOtpRequest request = new ResendVerificationOtpRequest();
        request.setEmail("test@example.com");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        authService.resendVerificationOtp(request);

        verify(otpService, never()).resendEmailVerificationOtp(user);
    }

    @Test
    void resendForUnknownEmailIsNeutral() {
        ResendVerificationOtpRequest request = new ResendVerificationOtpRequest();
        request.setEmail("unknown@example.com");
        when(userRepository.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());

        authService.resendVerificationOtp(request);

        verify(otpService, never()).resendEmailVerificationOtp(org.mockito.Mockito.any(User.class));
    }
}
