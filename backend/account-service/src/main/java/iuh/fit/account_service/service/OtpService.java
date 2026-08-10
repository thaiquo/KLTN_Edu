package iuh.fit.account_service.service;

import iuh.fit.account_service.entity.OtpVerification;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.OtpType;
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

        log.info(
                "\n================ EDUCONNECT DEV OTP ================\n"
                        + "Email : {}\n"
                        + "OTP   : {}\n"
                        + "Type  : {}\n"
                        + "Expire: {}\n"
                        + "====================================================",
                user.getEmail(),
                otp,
                OtpType.EMAIL_VERIFICATION,
                expiredAt
        );

        emailService.sendVerificationOtp(user.getEmail(), otp);
    }
}
