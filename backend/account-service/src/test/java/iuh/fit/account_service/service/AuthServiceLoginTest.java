package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.LoginRequest;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TutorApplicationStatus;
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
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceLoginTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final TutorRepository tutorRepository = mock(TutorRepository.class);
    private final TutorApplicationRepository tutorApplicationRepository = mock(TutorApplicationRepository.class);
    private final AuthenticationManager authenticationManager = mock(AuthenticationManager.class);
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
                authenticationManager,
                jwtService,
                refreshTokenService
        );
    }

    @Test
    void loginSuccessNormalizesEmailAuthenticatesAndReturnsRoles() {
        User user = user(1L, "test@gmail.com", true, AccountStatus.ACTIVE);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(1L)).thenReturn(List.of(role(user, Role.STUDENT)));
        when(studentRepository.existsByUserId(1L)).thenReturn(true);
        when(jwtService.generateToken("test@gmail.com", 1L, "STUDENT", List.of("STUDENT"), null)).thenReturn("jwt-token");
        when(refreshTokenService.createSession(user, "STUDENT")).thenReturn("refresh-token");

        var result = authService.login(loginRequest(" TEST@GMAIL.COM ", "12345678"));

        assertThat(result.getUserId()).isEqualTo(1L);
        assertThat(result.getEmail()).isEqualTo("test@gmail.com");
        assertThat(result.getRoles()).containsExactly("STUDENT");
        assertThat(result.getToken()).isEqualTo("jwt-token");
        assertThat(result.getRefreshToken()).isEqualTo("refresh-token");
        verify(refreshTokenService).createSession(user, "STUDENT");

        var authCaptor = org.mockito.ArgumentCaptor.forClass(UsernamePasswordAuthenticationToken.class);
        verify(authenticationManager).authenticate(authCaptor.capture());
        assertThat(authCaptor.getValue().getPrincipal()).isEqualTo("test@gmail.com");
        assertThat(authCaptor.getValue().getCredentials()).isEqualTo("12345678");
    }

    @Test
    void unverifiedEmailIsRejected() {
        User user = user(1L, "test@gmail.com", false, AccountStatus.ACTIVE);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(loginRequest("test@gmail.com", "12345678")))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Please verify your email first");

        verify(authenticationManager, never()).authenticate(any());
    }

    @Test
    void lockedAccountIsRejected() {
        User user = user(1L, "test@gmail.com", true, AccountStatus.LOCKED);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(loginRequest("test@gmail.com", "12345678")))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Account is not allowed to login");

        verify(authenticationManager, never()).authenticate(any());
    }

    @Test
    void disabledAccountIsRejected() {
        User user = user(1L, "test@gmail.com", true, AccountStatus.DISABLED);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(loginRequest("test@gmail.com", "12345678")))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Account is not allowed to login");

        verify(authenticationManager, never()).authenticate(any());
    }

    @Test
    void unknownEmailUsesGenericCredentialError() {
        when(userRepository.findByEmailIgnoreCase("unknown@gmail.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(loginRequest("unknown@gmail.com", "12345678")))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void wrongPasswordUsesGenericCredentialError() {
        User user = user(1L, "test@gmail.com", true, AccountStatus.ACTIVE);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(user));
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Invalid email or password"));

        assertThatThrownBy(() -> authService.login(loginRequest("test@gmail.com", "wrong-pass")))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void userWithMultipleRolesDefaultsToStudentActiveRole() {
        User user = user(1L, "tutor@gmail.com", true, AccountStatus.ACTIVE);
        when(userRepository.findByEmailIgnoreCase("tutor@gmail.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(1L)).thenReturn(List.of(
                role(user, Role.STUDENT),
                role(user, Role.TUTOR)
        ));
        when(studentRepository.existsByUserId(1L)).thenReturn(true);
        when(jwtService.generateToken("tutor@gmail.com", 1L, "STUDENT", List.of("STUDENT", "TUTOR"), null)).thenReturn("jwt-token");
        when(refreshTokenService.createSession(user, "STUDENT")).thenReturn("refresh-token");

        var result = authService.login(loginRequest("tutor@gmail.com", "12345678"));

        assertThat(result.getRoles()).containsExactly("STUDENT", "TUTOR");
        assertThat(result.getActiveRole()).isEqualTo("STUDENT");
    }

    @Test
    void tutorLoginUsesDraftApplicationStatusBeforeSubmission() {
        User user = user(2L, "draft.tutor@gmail.com", true, AccountStatus.ACTIVE);
        Tutor tutor = new Tutor();
        tutor.setUser(user);
        tutor.setStatus(iuh.fit.account_service.enums.TutorStatus.PENDING);
        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.DRAFT);

        when(userRepository.findByEmailIgnoreCase("draft.tutor@gmail.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(2L)).thenReturn(List.of(role(user, Role.TUTOR)));
        when(tutorRepository.findByUserId(2L)).thenReturn(Optional.of(tutor));
        when(tutorApplicationRepository.findByUserId(2L)).thenReturn(Optional.of(application));
        when(jwtService.generateToken("draft.tutor@gmail.com", 2L, "TUTOR", List.of("TUTOR"), "DRAFT"))
                .thenReturn("draft-jwt");
        when(refreshTokenService.createSession(user, "TUTOR")).thenReturn("draft-refresh");

        LoginRequest request = loginRequest("draft.tutor@gmail.com", "12345678");
        request.setTutorMode(true);

        var result = authService.login(request);

        assertThat(result.getActiveRole()).isEqualTo("TUTOR");
        assertThat(result.getTutorStatus()).isEqualTo("DRAFT");
        assertThat(result.getToken()).isEqualTo("draft-jwt");
    }

    private LoginRequest loginRequest(String email, String password) {
        LoginRequest request = new LoginRequest();
        request.setEmail(email);
        request.setPassword(password);
        return request;
    }

    private User user(Long id, String email, boolean emailVerified, AccountStatus status) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", id);
        user.setEmail(email);
        user.setPassword("$2a$hash");
        user.setFullName("Test User");
        user.setEmailVerified(emailVerified);
        user.setAccountStatus(status);
        return user;
    }

    private UserRole role(User user, Role role) {
        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        return userRole;
    }
}
