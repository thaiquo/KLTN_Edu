package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.auth.RegisterRequest;
import iuh.fit.account_service.dto.auth.RegisterResponse;
import iuh.fit.account_service.dto.auth.VerifyEmailRequest;
import iuh.fit.account_service.dto.auth.LoginRequest;
import iuh.fit.account_service.dto.auth.LoginResult;
import iuh.fit.account_service.entity.OtpVerification;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.OtpType;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final OtpVerificationRepository otpRepository;
    private final TutorRepository tutorRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            OtpVerificationRepository otpRepository,
            TutorRepository tutorRepository,
            PasswordEncoder passwordEncoder,
            OtpService otpService,
            AuthenticationManager authenticationManager,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.otpRepository = otpRepository;
        this.tutorRepository = tutorRepository;
        this.passwordEncoder = passwordEncoder;
        this.otpService = otpService;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists");
        }

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }

        if (request.getRole() != Role.STUDENT && request.getRole() != Role.TUTOR) {
            throw new RuntimeException("Only STUDENT or TUTOR can register");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName());
        user.setEmailVerified(false);
        user.setAccountStatus(AccountStatus.ACTIVE);

        userRepository.save(user);

        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(request.getRole());

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

    public LoginResult login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!user.isEmailVerified()) {
            throw new RuntimeException("Please verify your email first");
        }

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        List<UserRole> userRoles = userRoleRepository.findByUserId(user.getId());

        List<String> roles = userRoles.stream()
                .map(userRole -> userRole.getRole().name())
                .toList();

        if (roles.contains(Role.TUTOR.name()) && !tutorRepository.existsByUserId(user.getId())) {
            throw new RuntimeException("Please complete your tutor profile before login");
        }

        String token = jwtService.generateToken(user.getEmail(), roles);

        return new LoginResult(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                roles,
                token
        );
    }
}
