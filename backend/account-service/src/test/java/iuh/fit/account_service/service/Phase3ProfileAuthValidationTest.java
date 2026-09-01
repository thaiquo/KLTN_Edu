package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.CustomUserDetailsService;
import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.LoginRequest;
import iuh.fit.account_service.dto.auth.LoginResult;
import iuh.fit.account_service.dto.auth.RegisterRequest;
import iuh.fit.account_service.dto.auth.RegisterResponse;
import iuh.fit.account_service.dto.auth.SwitchRoleRequest;
import iuh.fit.account_service.entity.Student;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorStatus;
import iuh.fit.account_service.exception.ForbiddenException;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import iuh.fit.account_service.repository.StudentRepository;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class Phase3ProfileAuthValidationTest {

    private UserRepository userRepository;
    private UserRoleRepository userRoleRepository;
    private StudentRepository studentRepository;
    private TutorRepository tutorRepository;
    private TutorApplicationRepository tutorApplicationRepository;
    private OtpVerificationRepository otpRepository;
    private PasswordEncoder passwordEncoder;
    private OtpService otpService;
    private AuthenticationManager authenticationManager;
    private JwtService jwtService;
    private RefreshTokenService refreshTokenService;

    private AuthService authService;
    private CustomUserDetailsService userDetailsService;
    private UserService userService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userRoleRepository = mock(UserRoleRepository.class);
        studentRepository = mock(StudentRepository.class);
        tutorRepository = mock(TutorRepository.class);
        tutorApplicationRepository = mock(TutorApplicationRepository.class);
        otpRepository = mock(OtpVerificationRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        otpService = mock(OtpService.class);
        authenticationManager = mock(AuthenticationManager.class);
        jwtService = mock(JwtService.class);
        refreshTokenService = mock(RefreshTokenService.class);

        authService = new AuthService(
                userRepository,
                userRoleRepository,
                studentRepository,
                tutorRepository,
                tutorApplicationRepository,
                otpRepository,
                passwordEncoder,
                otpService,
                authenticationManager,
                jwtService,
                refreshTokenService
        );

        userDetailsService = new CustomUserDetailsService(
                userRepository,
                userRoleRepository,
                studentRepository,
                tutorRepository
        );

        userService = new UserService(
                userRepository,
                userRoleRepository,
                studentRepository,
                tutorRepository,
                passwordEncoder,
                mock(iuh.fit.account_service.service.storage.FileStorageService.class),
                mock(iuh.fit.account_service.config.FilePolicyProperties.class),
                mock(iuh.fit.account_service.repository.AdministrativeProvinceRepository.class),
                mock(iuh.fit.account_service.repository.AdministrativeCommuneRepository.class),
                tutorApplicationRepository,
                refreshTokenService
        );
    }

    @Test
    @DisplayName("Case 1 & 2 & 3: Student Register, OTP Verify, and Login Flow")
    void testStudentFlow() {
        RegisterRequest registerReq = new RegisterRequest();
        registerReq.setFullName("Student One");
        registerReq.setEmail("student1@example.com");
        registerReq.setPassword("Password123");
        registerReq.setConfirmPassword("Password123");
        registerReq.setRole("STUDENT");

        when(userRepository.existsByEmailIgnoreCase("student1@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            ReflectionTestUtils.setField(u, "id", 101L);
            return u;
        });

        RegisterResponse regResp = authService.register(registerReq);
        assertThat(regResp.getUserId()).isEqualTo(101L);
        assertThat(regResp.getEmail()).isEqualTo("student1@example.com");

        User user = new User();
        ReflectionTestUtils.setField(user, "id", 101L);
        user.setEmail("student1@example.com");
        user.setPassword(passwordEncoder.encode("Password123"));
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        when(userRepository.findByEmailIgnoreCase("student1@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(101L)).thenReturn(true);
        when(tutorRepository.findByUserId(101L)).thenReturn(Optional.empty());

        UserRole sRole = new UserRole();
        sRole.setUser(user);
        sRole.setRole(Role.STUDENT);
        when(userRoleRepository.findByUserId(101L)).thenReturn(List.of(sRole));
        when(jwtService.generateToken(eq("student1@example.com"), eq(101L), eq("STUDENT"), any(), eq(null))).thenReturn("student-jwt");
        when(refreshTokenService.createSession(user, "STUDENT")).thenReturn("student-refresh");

        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail("student1@example.com");
        loginReq.setPassword("Password123");
        loginReq.setTutorMode(false);

        LoginResult loginRes = authService.login(loginReq);
        assertThat(loginRes.getActiveRole()).isEqualTo("STUDENT");
        assertThat(loginRes.isHasStudentProfile()).isTrue();
        assertThat(loginRes.isHasTutorProfile()).isFalse();

        UserDetails userDetails = userDetailsService.loadUserByUsernameAndActiveRole("student1@example.com", "STUDENT");
        assertThat(userDetails.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_STUDENT");
    }

    @Test
    @DisplayName("Case 5 & 6: Tutor Login when PENDING (Success login, activeRole=TUTOR, NO ROLE_TUTOR authority)")
    void testTutorLoginPending() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 202L);
        user.setEmail("pending.tutor@example.com");
        user.setPassword(passwordEncoder.encode("Password123"));
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        Tutor pendingTutor = new Tutor();
        pendingTutor.setUser(user);
        pendingTutor.setStatus(TutorStatus.PENDING);

        UserRole tRole = new UserRole();
        tRole.setUser(user);
        tRole.setRole(Role.TUTOR);

        when(userRepository.findByEmailIgnoreCase("pending.tutor@example.com")).thenReturn(Optional.of(user));
        when(tutorRepository.findByUserId(202L)).thenReturn(Optional.of(pendingTutor));
        when(userRoleRepository.findByUserId(202L)).thenReturn(List.of(tRole));
        when(jwtService.generateToken(eq("pending.tutor@example.com"), eq(202L), eq("TUTOR"), any(), eq("PENDING"))).thenReturn("pending-tutor-jwt");
        when(refreshTokenService.createSession(user, "TUTOR")).thenReturn("pending-tutor-refresh");

        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail("pending.tutor@example.com");
        loginReq.setPassword("Password123");
        loginReq.setTutorMode(true);

        LoginResult result = authService.login(loginReq);
        assertThat(result.getActiveRole()).isEqualTo("TUTOR");
        assertThat(result.getTutorStatus()).isEqualTo("PENDING");

        UserDetails userDetails = userDetailsService.loadUserByUsernameAndActiveRole("pending.tutor@example.com", "TUTOR");
        assertThat(userDetails.getAuthorities()).isEmpty();
    }

    @Test
    @DisplayName("Case 7 & 8: Tutor Login when APPROVED (Success login, activeRole=TUTOR, HAS ROLE_TUTOR authority)")
    void testTutorLoginApproved() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 303L);
        user.setEmail("approved.tutor@example.com");
        user.setPassword(passwordEncoder.encode("Password123"));
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        Tutor approvedTutor = new Tutor();
        approvedTutor.setUser(user);
        approvedTutor.setStatus(TutorStatus.APPROVED);
        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.APPROVED);

        UserRole tRole = new UserRole();
        tRole.setUser(user);
        tRole.setRole(Role.TUTOR);

        when(userRepository.findByEmailIgnoreCase("approved.tutor@example.com")).thenReturn(Optional.of(user));
        when(tutorRepository.findByUserId(303L)).thenReturn(Optional.of(approvedTutor));
        when(userRoleRepository.findByUserId(303L)).thenReturn(List.of(tRole));
        when(jwtService.generateToken(eq("approved.tutor@example.com"), eq(303L), eq("TUTOR"), any(), eq("APPROVED"))).thenReturn("approved-tutor-jwt");
        when(refreshTokenService.createSession(user, "TUTOR")).thenReturn("approved-tutor-refresh");

        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail("approved.tutor@example.com");
        loginReq.setPassword("Password123");
        loginReq.setTutorMode(true);

        LoginResult result = authService.login(loginReq);
        assertThat(result.getActiveRole()).isEqualTo("TUTOR");
        assertThat(result.getTutorStatus()).isEqualTo("APPROVED");

        UserDetails userDetails = userDetailsService.loadUserByUsernameAndActiveRole("approved.tutor@example.com", "TUTOR");
        assertThat(userDetails.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_TUTOR");
    }

    @Test
    @DisplayName("Case 14 & 15: Tutor Login when REJECTED (Success login, activeRole=TUTOR, NO ROLE_TUTOR authority)")
    void testTutorLoginRejected() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 404L);
        user.setEmail("rejected.tutor@example.com");
        user.setPassword(passwordEncoder.encode("Password123"));
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        Tutor rejectedTutor = new Tutor();
        rejectedTutor.setUser(user);
        rejectedTutor.setStatus(TutorStatus.REJECTED);
        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.REJECTED);
        rejectedTutor.setRejectionReason("Bằng cấp không rõ ràng");

        UserRole tRole = new UserRole();
        tRole.setUser(user);
        tRole.setRole(Role.TUTOR);

        when(userRepository.findByEmailIgnoreCase("rejected.tutor@example.com")).thenReturn(Optional.of(user));
        when(tutorRepository.findByUserId(404L)).thenReturn(Optional.of(rejectedTutor));
        when(userRoleRepository.findByUserId(404L)).thenReturn(List.of(tRole));
        when(jwtService.generateToken(eq("rejected.tutor@example.com"), eq(404L), eq("TUTOR"), any(), eq("REJECTED"))).thenReturn("rejected-tutor-jwt");
        when(refreshTokenService.createSession(user, "TUTOR")).thenReturn("rejected-tutor-refresh");

        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail("rejected.tutor@example.com");
        loginReq.setPassword("Password123");
        loginReq.setTutorMode(true);

        LoginResult result = authService.login(loginReq);
        assertThat(result.getActiveRole()).isEqualTo("TUTOR");
        assertThat(result.getTutorStatus()).isEqualTo("REJECTED");

        UserDetails userDetails = userDetailsService.loadUserByUsernameAndActiveRole("rejected.tutor@example.com", "TUTOR");
        assertThat(userDetails.getAuthorities()).isEmpty();
    }

    @Test
    @DisplayName("Case 18: Login with non-existent Tutor profile throws 403 TUTOR_PROFILE_NOT_FOUND")
    void testLoginTutorNoProfileThrows403() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 505L);
        user.setEmail("student.only@example.com");
        user.setPassword(passwordEncoder.encode("Password123"));
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        when(userRepository.findByEmailIgnoreCase("student.only@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(505L)).thenReturn(true);
        when(tutorRepository.findByUserId(505L)).thenReturn(Optional.empty());

        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail("student.only@example.com");
        loginReq.setPassword("Password123");
        loginReq.setTutorMode(true);

        assertThatThrownBy(() -> authService.login(loginReq))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("TUTOR_PROFILE_NOT_FOUND");
    }

    @Test
    @DisplayName("Case 9 & 10: Switch Role between STUDENT and TUTOR")
    void testSwitchRole() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 606L);
        user.setEmail("dual.user@example.com");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        Tutor approvedTutor = new Tutor();
        approvedTutor.setUser(user);
        approvedTutor.setStatus(TutorStatus.APPROVED);
        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.APPROVED);

        UserRole sRole = new UserRole();
        sRole.setUser(user);
        sRole.setRole(Role.STUDENT);

        UserRole tRole = new UserRole();
        tRole.setUser(user);
        tRole.setRole(Role.TUTOR);

        when(userRepository.findByEmailIgnoreCase("dual.user@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(606L)).thenReturn(true);
        when(tutorRepository.findByUserId(606L)).thenReturn(Optional.of(approvedTutor));
        when(tutorApplicationRepository.findByUserId(606L)).thenReturn(Optional.of(application));
        when(userRoleRepository.findByUserId(606L)).thenReturn(List.of(sRole, tRole));

        SwitchRoleRequest switchReq = new SwitchRoleRequest();
        switchReq.setTargetRole("TUTOR");

        when(jwtService.generateToken(eq("dual.user@example.com"), eq(606L), eq("TUTOR"), any(), eq("APPROVED"))).thenReturn("jwt-tutor");
        LoginResult res1 = authService.switchRole("dual.user@example.com", switchReq);
        assertThat(res1.getActiveRole()).isEqualTo("TUTOR");

        switchReq.setTargetRole("STUDENT");
        when(jwtService.generateToken(eq("dual.user@example.com"), eq(606L), eq("STUDENT"), any(), eq("APPROVED"))).thenReturn("jwt-student");
        LoginResult res2 = authService.switchRole("dual.user@example.com", switchReq);
        assertThat(res2.getActiveRole()).isEqualTo("STUDENT");
    }

    @Test
    @DisplayName("Phase 5B: Switch Role denies PENDING Tutor full context")
    void testSwitchRolePendingTutorDenied() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 607L);
        user.setEmail("pending.switch@example.com");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        Tutor pendingTutor = new Tutor();
        pendingTutor.setUser(user);
        pendingTutor.setStatus(TutorStatus.PENDING);
        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.PENDING);

        UserRole tutorRole = new UserRole();
        tutorRole.setUser(user);
        tutorRole.setRole(Role.TUTOR);

        when(userRepository.findByEmailIgnoreCase("pending.switch@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(607L)).thenReturn(false);
        when(tutorRepository.findByUserId(607L)).thenReturn(Optional.of(pendingTutor));
        when(tutorApplicationRepository.findByUserId(607L)).thenReturn(Optional.of(application));
        when(userRoleRepository.findByUserId(607L)).thenReturn(List.of(tutorRole));

        SwitchRoleRequest switchReq = new SwitchRoleRequest();
        switchReq.setTargetRole("TUTOR");

        assertThatThrownBy(() -> authService.switchRole("pending.switch@example.com", switchReq))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("TUTOR_NOT_APPROVED");
    }

    @Test
    @DisplayName("Phase 5B: Switch Role denies REJECTED Tutor full context")
    void testSwitchRoleRejectedTutorDenied() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 608L);
        user.setEmail("rejected.switch@example.com");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        Tutor rejectedTutor = new Tutor();
        rejectedTutor.setUser(user);
        rejectedTutor.setStatus(TutorStatus.REJECTED);
        rejectedTutor.setRejectionReason("Minh chứng chưa rõ.");

        UserRole tutorRole = new UserRole();
        tutorRole.setUser(user);
        tutorRole.setRole(Role.TUTOR);

        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.REJECTED);

        when(userRepository.findByEmailIgnoreCase("rejected.switch@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(608L)).thenReturn(false);
        when(tutorRepository.findByUserId(608L)).thenReturn(Optional.of(rejectedTutor));
        when(tutorApplicationRepository.findByUserId(608L)).thenReturn(Optional.of(application));
        when(userRoleRepository.findByUserId(608L)).thenReturn(List.of(tutorRole));

        SwitchRoleRequest switchReq = new SwitchRoleRequest();
        switchReq.setTargetRole("TUTOR");

        assertThatThrownBy(() -> authService.switchRole("rejected.switch@example.com", switchReq))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("TUTOR_NOT_APPROVED");
    }

    @Test
    @DisplayName("Case 28: Revoked / Rejected Tutor with old JWT loses ROLE_TUTOR instantly on DB re-validation")
    void testRevokedTutorWithOldJwtLosesAuthority() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 707L);
        user.setEmail("revoked.tutor@example.com");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);

        Tutor tutor = new Tutor();
        tutor.setUser(user);
        tutor.setStatus(TutorStatus.REJECTED);

        when(userRepository.findByEmailIgnoreCase("revoked.tutor@example.com")).thenReturn(Optional.of(user));
        when(tutorRepository.findByUserId(707L)).thenReturn(Optional.of(tutor));

        UserDetails userDetails = userDetailsService.loadUserByUsernameAndActiveRole("revoked.tutor@example.com", "TUTOR");
        assertThat(userDetails.getAuthorities()).isEmpty();
    }

    @Test
    @DisplayName("Case 29 & 30: No Duplicate Student or Tutor Profile Creation")
    void testNoDuplicateProfiles() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 808L);
        user.setEmail("tutor.activate@example.com");

        when(userRepository.findByEmailIgnoreCase("tutor.activate@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(808L)).thenReturn(true);
        when(userRoleRepository.findByUserId(808L)).thenReturn(List.of());

        userService.activateStudentProfile("tutor.activate@example.com");

        verify(studentRepository, org.mockito.Mockito.never()).save(any(Student.class));
    }
}
