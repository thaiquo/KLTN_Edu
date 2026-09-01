package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.LoginResult;
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
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ForbiddenException;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import iuh.fit.account_service.repository.StudentRepository;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceSwitchRoleHardeningTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final TutorRepository tutorRepository = mock(TutorRepository.class);
    private final TutorApplicationRepository tutorApplicationRepository = mock(TutorApplicationRepository.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final RefreshTokenService refreshTokenService = mock(RefreshTokenService.class);
    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                userRoleRepository,
                studentRepository,
                tutorRepository,
                tutorApplicationRepository,
                mock(OtpVerificationRepository.class),
                mock(PasswordEncoder.class),
                mock(OtpService.class),
                mock(AuthenticationManager.class),
                jwtService,
                refreshTokenService
        );
    }

    @Test
    void studentOnlyCanStayStudentButCannotSwitchTutor() {
        User user = user(1L, "student@example.com");
        when(userRepository.findByEmailIgnoreCase("student@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(1L)).thenReturn(true);
        when(tutorRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(tutorApplicationRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(userRoleRepository.findByUserId(1L)).thenReturn(List.of(role(user, Role.STUDENT)));
        when(jwtService.generateToken("student@example.com", 1L, "STUDENT", List.of("STUDENT"), null))
                .thenReturn("student-token");

        LoginResult studentResult = authService.switchRole("student@example.com", request("STUDENT"));
        assertThat(studentResult.getActiveRole()).isEqualTo("STUDENT");
        assertThat(studentResult.isHasStudentProfile()).isTrue();

        assertThatThrownBy(() -> authService.switchRole("student@example.com", request("TUTOR")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ROLE_NOT_AVAILABLE");
    }

    @Test
    void draftTutorApplicationCannotSwitchToTutor() {
        assertTutorSwitchDeniedFor(TutorApplicationStatus.DRAFT, TutorStatus.PENDING);
    }

    @Test
    void pendingTutorApplicationCannotSwitchToTutor() {
        assertTutorSwitchDeniedFor(TutorApplicationStatus.PENDING, TutorStatus.PENDING);
    }

    @Test
    void rejectedTutorApplicationCannotSwitchToTutor() {
        assertTutorSwitchDeniedFor(TutorApplicationStatus.REJECTED, TutorStatus.REJECTED);
    }

    @Test
    void approvedTutorApplicationCanSwitchToTutor() {
        User user = user(5L, "approved@example.com");
        Tutor tutor = tutor(user, TutorStatus.APPROVED);
        TutorApplication application = application(user, TutorApplicationStatus.APPROVED);
        List<String> roles = List.of("STUDENT", "TUTOR");

        when(userRepository.findByEmailIgnoreCase("approved@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(5L)).thenReturn(true);
        when(tutorRepository.findByUserId(5L)).thenReturn(Optional.of(tutor));
        when(tutorApplicationRepository.findByUserId(5L)).thenReturn(Optional.of(application));
        when(userRoleRepository.findByUserId(5L)).thenReturn(List.of(role(user, Role.STUDENT), role(user, Role.TUTOR)));
        when(jwtService.generateToken("approved@example.com", 5L, "TUTOR", roles, "APPROVED"))
                .thenReturn("approved-token");

        LoginResult result = authService.switchRole("approved@example.com", request("TUTOR"), "refresh-token");

        assertThat(result.getActiveRole()).isEqualTo("TUTOR");
        assertThat(result.getTutorStatus()).isEqualTo("APPROVED");
        assertThat(result.getToken()).isEqualTo("approved-token");
        verify(refreshTokenService).updateActiveRoleIfPresent("refresh-token", "TUTOR");
    }

    @Test
    void dualRoleApprovedTutorCanSwitchBackToStudent() {
        User user = user(6L, "dual@example.com");
        Tutor tutor = tutor(user, TutorStatus.APPROVED);
        TutorApplication application = application(user, TutorApplicationStatus.APPROVED);
        List<String> roles = List.of("STUDENT", "TUTOR");

        when(userRepository.findByEmailIgnoreCase("dual@example.com")).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(6L)).thenReturn(true);
        when(tutorRepository.findByUserId(6L)).thenReturn(Optional.of(tutor));
        when(tutorApplicationRepository.findByUserId(6L)).thenReturn(Optional.of(application));
        when(userRoleRepository.findByUserId(6L)).thenReturn(List.of(role(user, Role.STUDENT), role(user, Role.TUTOR)));
        when(jwtService.generateToken("dual@example.com", 6L, "STUDENT", roles, "APPROVED"))
                .thenReturn("student-token");

        LoginResult result = authService.switchRole("dual@example.com", request("STUDENT"));

        assertThat(result.getActiveRole()).isEqualTo("STUDENT");
        assertThat(result.isHasStudentProfile()).isTrue();
        assertThat(result.isHasTutorProfile()).isTrue();
    }

    private void assertTutorSwitchDeniedFor(TutorApplicationStatus applicationStatus, TutorStatus tutorStatus) {
        long userId = 10L + applicationStatus.ordinal();
        String email = applicationStatus.name().toLowerCase() + ".switch@example.com";
        User user = user(userId, email);
        Tutor tutor = tutor(user, tutorStatus);
        TutorApplication application = application(user, applicationStatus);

        when(userRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(user));
        when(studentRepository.existsByUserId(userId)).thenReturn(true);
        when(tutorRepository.findByUserId(userId)).thenReturn(Optional.of(tutor));
        when(tutorApplicationRepository.findByUserId(userId)).thenReturn(Optional.of(application));
        when(userRoleRepository.findByUserId(userId)).thenReturn(List.of(role(user, Role.STUDENT), role(user, Role.TUTOR)));

        assertThatThrownBy(() -> authService.switchRole(email, request("TUTOR"), "refresh-token"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("TUTOR_NOT_APPROVED");

        verify(refreshTokenService, never()).updateActiveRoleIfPresent("refresh-token", "TUTOR");
    }

    private SwitchRoleRequest request(String targetRole) {
        SwitchRoleRequest request = new SwitchRoleRequest();
        request.setTargetRole(targetRole);
        return request;
    }

    private User user(Long id, String email) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", id);
        user.setEmail(email);
        user.setPassword("$2a$hash");
        user.setFullName("Test User");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);
        return user;
    }

    private UserRole role(User user, Role role) {
        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        return userRole;
    }

    private Tutor tutor(User user, TutorStatus status) {
        Tutor tutor = new Tutor();
        tutor.setUser(user);
        tutor.setStatus(status);
        return tutor;
    }

    private TutorApplication application(User user, TutorApplicationStatus status) {
        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.setStatus(status);
        return application;
    }
}
