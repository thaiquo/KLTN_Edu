package iuh.fit.account_service.service;

import iuh.fit.account_service.config.OtpProperties;
import iuh.fit.account_service.entity.OtpVerification;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.OtpType;
import iuh.fit.account_service.exception.InvalidOtpException;
import iuh.fit.account_service.exception.TooManyRequestsException;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OtpVerificationRepository otpRepository;
    private final EmailService emailService;
    private final OtpProperties otpProperties;

    public OtpService(
            OtpVerificationRepository otpRepository,
            EmailService emailService,
            OtpProperties otpProperties
    ) {
        this.otpRepository = otpRepository;
        this.emailService = emailService;
        this.otpProperties = otpProperties;
    }

    @Transactional
    public void generateAndSendEmailVerificationOtp(User user) {
        createAndSendOtp(user, OtpType.EMAIL_VERIFICATION);
    }

    @Transactional
    public void resendEmailVerificationOtp(User user) {
        enforceCooldown(user, OtpType.EMAIL_VERIFICATION);
        createAndSendOtp(user, OtpType.EMAIL_VERIFICATION);
    }

    @Transactional
    public void generateAndSendPasswordResetOtpIfAllowed(User user) {
        if (isInCooldown(user, OtpType.PASSWORD_RESET)) {
            return;
        }

        createAndSendOtp(user, OtpType.PASSWORD_RESET);
    }

    public void verifyEmailOtp(User user, String requestedOtp) {
        verifyOtp(user, OtpType.EMAIL_VERIFICATION, requestedOtp);
    }

    public void verifyPasswordResetOtp(User user, String requestedOtp) {
        verifyOtp(user, OtpType.PASSWORD_RESET, requestedOtp);
        otpRepository.invalidateActiveOtps(user.getId(), OtpType.PASSWORD_RESET);
    }

    private void verifyOtp(User user, OtpType type, String requestedOtp) {
        OtpVerification otp = otpRepository
                .findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
                        user.getId(),
                        type
                )
                .orElseThrow(() -> new InvalidOtpException("OTP not found or no longer active"));

        if (otp.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new InvalidOtpException("OTP has expired");
        }

        if (otp.getAttempts() >= otpProperties.getMaxAttempts()) {
            throw new InvalidOtpException("OTP verification attempts exceeded");
        }

        if (!otp.getOtp().equals(requestedOtp)) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpRepository.save(otp);
            throw new InvalidOtpException("Invalid OTP");
        }

        otp.setVerified(true);
        otp.setUsedAt(LocalDateTime.now());
        otpRepository.save(otp);
    }

    private void createAndSendOtp(User user, OtpType type) {
        otpRepository.invalidateActiveOtps(user.getId(), type);

        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        LocalDateTime expiredAt = LocalDateTime.now().plus(otpProperties.getExpiration());

        OtpVerification verification = new OtpVerification();
        verification.setUser(user);
        verification.setOtp(otp);
        verification.setType(type);
        verification.setExpiredAt(expiredAt);
        verification.setAttempts(0);
        verification.setVerified(false);
        verification.setInvalidated(false);

        otpRepository.save(verification);

        logOtpForDevelopment(user, type, otp, expiredAt);

        if (type == OtpType.PASSWORD_RESET) {
            emailService.sendPasswordResetOtp(user.getEmail(), otp);
        } else {
            emailService.sendVerificationOtp(user.getEmail(), otp);
        }
    }

    private void logOtpForDevelopment(User user, OtpType type, String otp, LocalDateTime expiredAt) {
        if (!otpProperties.isLogToConsole()) {
            return;
        }

        log.info(
                "\n================ EDUCONNECT DEV OTP ================\n"
                        + "Email : {}\n"
                        + "OTP   : {}\n"
                        + "Type  : {}\n"
                        + "Expire: {}\n"
                        + "====================================================",
                user.getEmail(),
                otp,
                type,
                expiredAt
        );
    }

    private void enforceCooldown(User user, OtpType type) {
        if (isInCooldown(user, type)) {
            throw new TooManyRequestsException("Please wait before requesting another OTP");
        }
    }

    private boolean isInCooldown(User user, OtpType type) {
        OtpVerification latestOtp = otpRepository
                .findTopByUserIdAndTypeOrderByCreatedAtDesc(user.getId(), type)
                .orElse(null);

        if (latestOtp == null || latestOtp.getCreatedAt() == null) {
            return false;
        }

        LocalDateTime nextAllowedAt = latestOtp.getCreatedAt().plus(otpProperties.getResendCooldown());
        return LocalDateTime.now().isBefore(nextAllowedAt);
    }
}
