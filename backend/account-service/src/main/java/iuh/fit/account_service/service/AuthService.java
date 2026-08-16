package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.auth.RegisterRequest;
import iuh.fit.account_service.dto.auth.RegisterResponse;
import iuh.fit.account_service.dto.auth.ResendVerificationOtpRequest;
import iuh.fit.account_service.dto.auth.ForgotPasswordRequest;
import iuh.fit.account_service.dto.auth.ResetPasswordRequest;
import iuh.fit.account_service.dto.auth.VerifyEmailRequest;
import iuh.fit.account_service.dto.auth.LoginRequest;
import iuh.fit.account_service.dto.auth.LoginResult;
import iuh.fit.account_service.dto.auth.SwitchRoleRequest;
import iuh.fit.account_service.entity.Student;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TutorStatus;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.ForbiddenException;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import iuh.fit.account_service.repository.StudentRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final StudentRepository studentRepository;
    private final TutorRepository tutorRepository;
    private final OtpVerificationRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            StudentRepository studentRepository,
            TutorRepository tutorRepository,
            OtpVerificationRepository otpRepository,
            PasswordEncoder passwordEncoder,
            OtpService otpService,
            AuthenticationManager authenticationManager,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.studentRepository = studentRepository;
        this.tutorRepository = tutorRepository;
        this.otpRepository = otpRepository;
        this.passwordEncoder = passwordEncoder;
        this.otpService = otpService;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        String normalizedEmail = EmailNormalizer.normalize(request.getEmail());
        String fullName = request.getFullName() == null ? null : request.getFullName().trim();
        String requestedRole = (request.getRole() != null && !request.getRole().isBlank())
                ? request.getRole().trim().toUpperCase()
                : "STUDENT";

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match");
        }

        User existingUser = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (existingUser != null) {
            if (existingUser.isEmailVerified()) {
                throw new ConflictException("Email already exists");
            }

            existingUser.setFullName(fullName);
            existingUser.setPassword(passwordEncoder.encode(request.getPassword()));
            existingUser.setAccountStatus(AccountStatus.ACTIVE);
            userRepository.save(existingUser);

            createProfileForRegisteredRole(existingUser, requestedRole);
            otpService.resendEmailVerificationOtp(existingUser);

            return new RegisterResponse(
                    existingUser.getId(),
                    existingUser.getEmail(),
                    "Registration is pending verification. A new OTP has been sent."
            );
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(fullName);
        user.setEmailVerified(false);
        user.setAccountStatus(AccountStatus.ACTIVE);

        userRepository.save(user);

        createProfileForRegisteredRole(user, requestedRole);
        otpService.generateAndSendEmailVerificationOtp(user);

        return new RegisterResponse(
                user.getId(),
                user.getEmail(),
                "Registration successful. Please verify your email."
        );
    }

    private void createProfileForRegisteredRole(User user, String role) {
        if ("TUTOR".equalsIgnoreCase(role)) {
            if (!tutorRepository.existsByUserId(user.getId())) {
                Tutor tutor = new Tutor();
                tutor.setUser(user);
                tutor.setStatus(TutorStatus.PENDING);
                tutorRepository.save(tutor);
            }
            if (!userRoleRepository.existsByUserIdAndRole(user.getId(), Role.TUTOR)) {
                UserRole userRole = new UserRole();
                userRole.setUser(user);
                userRole.setRole(Role.TUTOR);
                userRoleRepository.save(userRole);
            }
        } else {
            if (!studentRepository.existsByUserId(user.getId())) {
                Student student = new Student();
                student.setUser(user);
                studentRepository.save(student);
            }
            if (!userRoleRepository.existsByUserIdAndRole(user.getId(), Role.STUDENT)) {
                UserRole userRole = new UserRole();
                userRole.setUser(user);
                userRole.setRole(Role.STUDENT);
                userRoleRepository.save(userRole);
            }
        }
    }

    @Transactional
    public void verifyEmail(VerifyEmailRequest request) {
        String normalizedEmail = EmailNormalizer.normalize(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BadRequestException("Invalid email or OTP"));

        if (user.isEmailVerified()) {
            return;
        }

        otpService.verifyEmailOtp(user, request.getOtp());
        user.setEmailVerified(true);
        userRepository.save(user);

        // Ensure at least one profile exists
        if (!studentRepository.existsByUserId(user.getId()) && !tutorRepository.existsByUserId(user.getId())) {
            Student student = new Student();
            student.setUser(user);
            studentRepository.save(student);
        }
    }

    @Transactional
    public void resendVerificationOtp(ResendVerificationOtpRequest request) {
        String normalizedEmail = EmailNormalizer.normalize(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElse(null);

        if (user == null || user.isEmailVerified()) {
            return;
        }

        otpService.resendEmailVerificationOtp(user);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String normalizedEmail = EmailNormalizer.normalize(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElse(null);

        if (user == null || !user.isEmailVerified()) {
            return;
        }

        otpService.generateAndSendPasswordResetOtpIfAllowed(user);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match");
        }

        String normalizedEmail = EmailNormalizer.normalize(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BadRequestException("Invalid email or OTP"));

        otpService.verifyPasswordResetOtp(user, request.getOtp());
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public LoginResult login(LoginRequest request) {
        String normalizedEmail = EmailNormalizer.normalize(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!user.isEmailVerified()) {
            throw new ForbiddenException("Please verify your email first");
        }

        if (user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new ForbiddenException("Account is not allowed to login");
        }

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        normalizedEmail,
                        request.getPassword()
                )
        );

        List<UserRole> userRoles = userRoleRepository.findByUserId(user.getId());
        List<String> roles = userRoles.stream()
                .map(userRole -> userRole.getRole().name())
                .toList();

        boolean hasStudent = studentRepository.existsByUserId(user.getId());
        Optional<Tutor> tutorOpt = tutorRepository.findByUserId(user.getId());
        boolean hasTutor = tutorOpt.isPresent();
        String tutorStatusStr = tutorOpt.map(t -> t.getStatus().name()).orElse(null);

        boolean isTutorMode = Boolean.TRUE.equals(request.getTutorMode());

        String selectedActiveRole;

        if (isTutorMode) {
            if (!hasTutor) {
                throw new ForbiddenException("TUTOR_PROFILE_NOT_FOUND: Tài khoản chưa đăng ký làm gia sư.");
            }
            selectedActiveRole = "TUTOR";
        } else {
            if (roles.contains("ADMIN")) {
                selectedActiveRole = "ADMIN";
            } else if (roles.contains("STAFF")) {
                selectedActiveRole = "STAFF";
            } else {
                if (!hasStudent) {
                    throw new ForbiddenException("STUDENT_PROFILE_NOT_FOUND: Tài khoản chưa đăng ký làm học viên.");
                }
                selectedActiveRole = "STUDENT";
            }
        }

        String token = jwtService.generateToken(user.getEmail(), selectedActiveRole, roles);

        return new LoginResult(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                roles,
                selectedActiveRole,
                hasStudent,
                hasTutor,
                tutorStatusStr,
                token
        );
    }

    public LoginResult switchRole(String authenticatedEmail, SwitchRoleRequest request) {
        String normalizedEmail = EmailNormalizer.normalize(authenticatedEmail);
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        String targetRole = request.getTargetRole() == null ? "" : request.getTargetRole().trim().toUpperCase();

        boolean hasStudent = studentRepository.existsByUserId(user.getId());
        Optional<Tutor> tutorOpt = tutorRepository.findByUserId(user.getId());
        boolean hasTutor = tutorOpt.isPresent();
        String tutorStatusStr = tutorOpt.map(t -> t.getStatus().name()).orElse(null);

        List<UserRole> userRoles = userRoleRepository.findByUserId(user.getId());
        List<String> roles = userRoles.stream()
                .map(userRole -> userRole.getRole().name())
                .toList();

        if ("STUDENT".equals(targetRole)) {
            if (!hasStudent) {
                throw new BadRequestException("ROLE_NOT_AVAILABLE: Bạn chưa có hồ sơ Học viên.");
            }
        } else if ("TUTOR".equals(targetRole)) {
            if (!hasTutor) {
                throw new BadRequestException("ROLE_NOT_AVAILABLE: Bạn chưa đăng ký làm Gia sư.");
            }
            if (tutorOpt.get().getStatus() != TutorStatus.APPROVED) {
                throw new BadRequestException("TUTOR_NOT_APPROVED: Hồ sơ Gia sư chưa được duyệt.");
            }
        } else if ("STAFF".equals(targetRole) || "ADMIN".equals(targetRole)) {
            if (!roles.contains(targetRole)) {
                throw new BadRequestException("ROLE_NOT_AVAILABLE: Bạn không có quyền " + targetRole);
            }
        } else {
            throw new BadRequestException("Invalid target role: " + targetRole);
        }

        String newToken = jwtService.generateToken(user.getEmail(), targetRole, roles);

        return new LoginResult(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                roles,
                targetRole,
                hasStudent,
                hasTutor,
                tutorStatusStr,
                newToken
        );
    }
}
