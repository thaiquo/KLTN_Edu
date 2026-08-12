package iuh.fit.account_service.modules.auth.legacy.service;

import iuh.fit.account_service.modules.auth.legacy.entity.OtpVerification;
import iuh.fit.account_service.modules.user.entity.User;
import iuh.fit.account_service.modules.auth.legacy.enums.OtpType;
import iuh.fit.account_service.modules.auth.legacy.repository.OtpVerificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

public class OtpService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final OtpVerificationRepository otpRepository;
    private final EmailService emailService;

    public OtpService(OtpVerificationRepository otpRepository, EmailService emailService) {
        this.otpRepository = otpRepository;
        this.emailService = emailService;
    }

    @Transactional
    public void generateAndSendEmailVerificationOtp(User user) {
        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        LocalDateTime expiredAt = LocalDateTime.now().plusMinutes(5);

        OtpVerification verification = new OtpVerification();
        verification.setUser(user);
        verification.setOtp(otp);
        verification.setType(OtpType.EMAIL_VERIFICATION);
        verification.setExpiredAt(expiredAt);
        verification.setAttempts(0);
        verification.setVerified(false);

        otpRepository.save(verification);

        emailService.sendVerificationOtp(user.getEmail(), otp);
    }
}
