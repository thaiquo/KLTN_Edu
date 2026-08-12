package iuh.fit.account_service.modules.auth.legacy.service;

import iuh.fit.account_service.modules.auth.legacy.dto.RegisterRequest;
import iuh.fit.account_service.modules.auth.legacy.dto.RegisterResponse;
import iuh.fit.account_service.modules.auth.legacy.dto.VerifyEmailRequest;
import iuh.fit.account_service.modules.auth.legacy.entity.OtpVerification;
import iuh.fit.account_service.modules.user.entity.User;
import iuh.fit.account_service.modules.role.entity.LegacyUserRole;
import iuh.fit.account_service.modules.user.enums.AccountStatus;
import iuh.fit.account_service.modules.auth.legacy.enums.OtpType;
import iuh.fit.account_service.modules.role.enums.LegacyRole;
import iuh.fit.account_service.modules.auth.legacy.repository.OtpVerificationRepository;
import iuh.fit.account_service.modules.user.repository.UserRepository;
import iuh.fit.account_service.modules.role.repository.LegacyUserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final LegacyUserRoleRepository userRoleRepository;
    private final OtpVerificationRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists");
        }

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName());
        user.setEmailVerified(false);
        user.setAccountStatus(AccountStatus.ACTIVE);

        userRepository.save(user);

        LegacyUserRole userRole = new LegacyUserRole();
        userRole.setUser(user);
        userRole.setRole(LegacyRole.STUDENT);

        userRoleRepository.save(userRole);

        otpService.generateAndSendEmailVerificationOtp(user);

        return new RegisterResponse(
                user.getId(),
                user.getEmail(),
                "Registration successful. Please verify your email."
        );
    }

    @Transactional
    public void verifyEmail(VerifyEmailRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.isEmailVerified()) {
            throw new RuntimeException("Email has already been verified");
        }

        OtpVerification otp = otpRepository
                .findTopByUserIdAndTypeOrderByCreatedAtDesc(
                        user.getId(),
                        OtpType.EMAIL_VERIFICATION
                )
                .orElseThrow(() -> new RuntimeException("OTP not found"));

        if (otp.isVerified()) {
            throw new RuntimeException("OTP has already been used");
        }

        if (otp.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("OTP has expired");
        }

        if (!otp.getOtp().equals(request.getOtp())) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpRepository.save(otp);
            throw new RuntimeException("Invalid OTP");
        }

        otp.setVerified(true);
        otpRepository.save(otp);

        user.setEmailVerified(true);
        userRepository.save(user);
    }
}
