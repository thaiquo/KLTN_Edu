package iuh.fit.account_service.service;

import iuh.fit.account_service.config.OtpProperties;
import iuh.fit.account_service.entity.OtpVerification;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.OtpType;
import iuh.fit.account_service.exception.InvalidOtpException;
import iuh.fit.account_service.exception.TooManyRequestsException;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class OtpServiceTest {

    private final OtpVerificationRepository otpRepository = mock(OtpVerificationRepository.class);
    private final EmailService emailService = mock(EmailService.class);
    private final OtpProperties otpProperties = new OtpProperties();
    private OtpService otpService;
    private User user;

    @BeforeEach
    void setUp() {
        otpProperties.setMaxAttempts(5);
        otpProperties.setExpiration(Duration.ofMinutes(5));
        otpProperties.setResendCooldown(Duration.ofSeconds(60));
        otpService = new OtpService(otpRepository, emailService, otpProperties);

        user = new User();
        ReflectionTestUtils.setField(user, "id", 10L);
        user.setEmail("test@example.com");
    }

    @Test
    void generateInvalidatesOldActiveOtpAndSendsNewEmail() {
        when(otpRepository.save(any(OtpVerification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        otpService.generateAndSendEmailVerificationOtp(user);

        verify(otpRepository).invalidateActiveOtps(10L, OtpType.EMAIL_VERIFICATION);
        var captor = org.mockito.ArgumentCaptor.forClass(OtpVerification.class);
        verify(otpRepository).save(captor.capture());

        OtpVerification savedOtp = captor.getValue();
        assertThat(savedOtp.getOtp()).matches("\\d{6}");
        assertThat(savedOtp.isVerified()).isFalse();
        assertThat(savedOtp.isInvalidated()).isFalse();
        assertThat(savedOtp.getAttempts()).isZero();
        assertThat(savedOtp.getExpiredAt()).isAfter(LocalDateTime.now());

        verify(emailService).sendVerificationOtp(org.mockito.Mockito.eq("test@example.com"), org.mockito.Mockito.matches("\\d{6}"));
    }

    @Test
    void otpIsNotLoggedByDefault(CapturedOutput output) {
        when(otpRepository.save(any(OtpVerification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        otpService.generateAndSendEmailVerificationOtp(user);

        assertThat(output.toString())
                .doesNotContain("EDUCONNECT DEV OTP")
                .doesNotContain("OTP   :");
    }

    @Test
    void emailVerificationOtpIsLoggedOnlyWhenConfigured(CapturedOutput output) {
        otpProperties.setLogToConsole(true);
        when(otpRepository.save(any(OtpVerification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        otpService.generateAndSendEmailVerificationOtp(user);

        assertThat(output.toString())
                .contains("EDUCONNECT DEV OTP")
                .contains("Email : test@example.com")
                .contains("Type  : EMAIL_VERIFICATION")
                .containsPattern("OTP\\s+:\\s+\\d{6}");
    }

    @Test
    void passwordResetOtpIsLoggedOnlyWhenConfigured(CapturedOutput output) {
        otpProperties.setLogToConsole(true);
        when(otpRepository.findTopByUserIdAndTypeOrderByCreatedAtDesc(10L, OtpType.PASSWORD_RESET))
                .thenReturn(Optional.empty());
        when(otpRepository.save(any(OtpVerification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        otpService.generateAndSendPasswordResetOtpIfAllowed(user);

        assertThat(output.toString())
                .contains("EDUCONNECT DEV OTP")
                .contains("Email : test@example.com")
                .contains("Type  : PASSWORD_RESET")
                .containsPattern("OTP\\s+:\\s+\\d{6}");
    }

    @Test
    void verifySuccessMarksOtpUsed() {
        OtpVerification otp = activeOtp("123456", 0, LocalDateTime.now().plusMinutes(2));
        when(otpRepository.findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
                10L,
                OtpType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(otp));

        otpService.verifyEmailOtp(user, "123456");

        assertThat(otp.isVerified()).isTrue();
        assertThat(otp.getUsedAt()).isNotNull();
        verify(otpRepository).save(otp);
    }

    @Test
    void wrongOtpIncrementsAttempts() {
        OtpVerification otp = activeOtp("123456", 1, LocalDateTime.now().plusMinutes(2));
        when(otpRepository.findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
                10L,
                OtpType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(otp));

        assertThatThrownBy(() -> otpService.verifyEmailOtp(user, "000000"))
                .isInstanceOf(InvalidOtpException.class)
                .hasMessage("Invalid OTP");

        assertThat(otp.getAttempts()).isEqualTo(2);
        verify(otpRepository).save(otp);
    }

    @Test
    void maxAttemptsRejectsOtp() {
        OtpVerification otp = activeOtp("123456", 5, LocalDateTime.now().plusMinutes(2));
        when(otpRepository.findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
                10L,
                OtpType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(otp));

        assertThatThrownBy(() -> otpService.verifyEmailOtp(user, "123456"))
                .isInstanceOf(InvalidOtpException.class)
                .hasMessage("OTP verification attempts exceeded");

        verify(otpRepository, never()).save(any(OtpVerification.class));
    }

    @Test
    void expiredOtpIsRejected() {
        OtpVerification otp = activeOtp("123456", 0, LocalDateTime.now().minusSeconds(1));
        when(otpRepository.findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
                10L,
                OtpType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(otp));

        assertThatThrownBy(() -> otpService.verifyEmailOtp(user, "123456"))
                .isInstanceOf(InvalidOtpException.class)
                .hasMessage("OTP has expired");

        verify(otpRepository, never()).save(any(OtpVerification.class));
    }

    @Test
    void usedOrInvalidatedOtpIsRejectedWhenNoActiveOtpExists() {
        when(otpRepository.findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
                10L,
                OtpType.EMAIL_VERIFICATION
        )).thenReturn(Optional.empty());

        assertThatThrownBy(() -> otpService.verifyEmailOtp(user, "123456"))
                .isInstanceOf(InvalidOtpException.class)
                .hasMessage("OTP not found or no longer active");
    }

    @Test
    void resendCreatesNewOtpWhenCooldownPassed() {
        OtpVerification latest = activeOtp("111111", 0, LocalDateTime.now().plusMinutes(1));
        ReflectionTestUtils.setField(latest, "createdAt", LocalDateTime.now().minusMinutes(2));
        when(otpRepository.findTopByUserIdAndTypeOrderByCreatedAtDesc(10L, OtpType.EMAIL_VERIFICATION))
                .thenReturn(Optional.of(latest));
        when(otpRepository.save(any(OtpVerification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        otpService.resendEmailVerificationOtp(user);

        verify(otpRepository).invalidateActiveOtps(10L, OtpType.EMAIL_VERIFICATION);
        verify(otpRepository).save(any(OtpVerification.class));
        verify(emailService).sendVerificationOtp(org.mockito.Mockito.eq("test@example.com"), org.mockito.Mockito.matches("\\d{6}"));
    }

    @Test
    void resendCooldownRejectsTooEarlyRequest() {
        OtpVerification latest = activeOtp("111111", 0, LocalDateTime.now().plusMinutes(1));
        ReflectionTestUtils.setField(latest, "createdAt", LocalDateTime.now());
        when(otpRepository.findTopByUserIdAndTypeOrderByCreatedAtDesc(10L, OtpType.EMAIL_VERIFICATION))
                .thenReturn(Optional.of(latest));

        assertThatThrownBy(() -> otpService.resendEmailVerificationOtp(user))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessage("Please wait before requesting another OTP");

        verify(otpRepository, never()).invalidateActiveOtps(10L, OtpType.EMAIL_VERIFICATION);
        verify(emailService, never()).sendVerificationOtp(any(), any());
    }

    @Test
    void forgotPasswordGeneratesPasswordResetOtpWithoutAffectingEmailVerificationOtp() {
        when(otpRepository.findTopByUserIdAndTypeOrderByCreatedAtDesc(10L, OtpType.PASSWORD_RESET))
                .thenReturn(Optional.empty());
        when(otpRepository.save(any(OtpVerification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        otpService.generateAndSendPasswordResetOtpIfAllowed(user);

        verify(otpRepository).invalidateActiveOtps(10L, OtpType.PASSWORD_RESET);
        var captor = org.mockito.ArgumentCaptor.forClass(OtpVerification.class);
        verify(otpRepository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo(OtpType.PASSWORD_RESET);
        verify(otpRepository, never()).invalidateActiveOtps(10L, OtpType.EMAIL_VERIFICATION);
        verify(emailService).sendPasswordResetOtp(org.mockito.Mockito.eq("test@example.com"), org.mockito.Mockito.matches("\\d{6}"));
    }

    @Test
    void forgotPasswordDuringCooldownDoesNotLeakOrSendNewOtp() {
        OtpVerification latest = activeOtp("111111", 0, LocalDateTime.now().plusMinutes(1));
        ReflectionTestUtils.setField(latest, "createdAt", LocalDateTime.now());
        when(otpRepository.findTopByUserIdAndTypeOrderByCreatedAtDesc(10L, OtpType.PASSWORD_RESET))
                .thenReturn(Optional.of(latest));

        otpService.generateAndSendPasswordResetOtpIfAllowed(user);

        verify(otpRepository, never()).invalidateActiveOtps(10L, OtpType.PASSWORD_RESET);
        verify(emailService, never()).sendPasswordResetOtp(any(), any());
    }

    @Test
    void passwordResetOtpSuccessMarksUsedAndInvalidatesOtherPasswordResetOtps() {
        OtpVerification otp = activeOtp("123456", 0, LocalDateTime.now().plusMinutes(2));
        otp.setType(OtpType.PASSWORD_RESET);
        when(otpRepository.findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
                10L,
                OtpType.PASSWORD_RESET
        )).thenReturn(Optional.of(otp));

        otpService.verifyPasswordResetOtp(user, "123456");

        assertThat(otp.isVerified()).isTrue();
        assertThat(otp.getUsedAt()).isNotNull();
        verify(otpRepository).save(otp);
        verify(otpRepository).invalidateActiveOtps(10L, OtpType.PASSWORD_RESET);
    }

    @Test
    void emailVerificationOtpCannotBeUsedForPasswordReset() {
        when(otpRepository.findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
                10L,
                OtpType.PASSWORD_RESET
        )).thenReturn(Optional.empty());

        assertThatThrownBy(() -> otpService.verifyPasswordResetOtp(user, "123456"))
                .isInstanceOf(InvalidOtpException.class)
                .hasMessage("OTP not found or no longer active");

        verify(otpRepository, never()).invalidateActiveOtps(10L, OtpType.PASSWORD_RESET);
    }

    private OtpVerification activeOtp(String value, int attempts, LocalDateTime expiredAt) {
        OtpVerification otp = new OtpVerification();
        otp.setUser(user);
        otp.setType(OtpType.EMAIL_VERIFICATION);
        otp.setOtp(value);
        otp.setAttempts(attempts);
        otp.setExpiredAt(expiredAt);
        otp.setVerified(false);
        otp.setInvalidated(false);
        ReflectionTestUtils.setField(otp, "createdAt", LocalDateTime.now().minusMinutes(1));
        return otp;
    }
}
