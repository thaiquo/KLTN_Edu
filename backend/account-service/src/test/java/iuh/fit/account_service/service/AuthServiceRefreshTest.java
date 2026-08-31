package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.RefreshTokenRotation;
import iuh.fit.account_service.entity.RefreshSession;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceRefreshTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final TutorRepository tutorRepository = mock(TutorRepository.class);
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
                mock(TutorApplicationRepository.class),
                mock(OtpVerificationRepository.class),
                mock(PasswordEncoder.class),
                mock(OtpService.class),
                mock(AuthenticationManager.class),
                jwtService,
                refreshTokenService
        );
    }

    @Test
    void refreshUsesRotatedRefreshSessionAndIssuesNewAccessToken() {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 77L);
        user.setEmail("student@example.com");
        user.setFullName("Student User");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);
        UserRole role = new UserRole();
        role.setUser(user);
        role.setRole(Role.STUDENT);
        RefreshSession replacement = new RefreshSession();
        replacement.setUser(user);
        replacement.setActiveRole("STUDENT");

        when(refreshTokenService.consumeForRefresh("old-refresh-token"))
                .thenReturn(new RefreshTokenRotation(replacement, "new-refresh-token"));
        when(userRoleRepository.findByUserId(77L)).thenReturn(List.of(role));
        when(studentRepository.existsByUserId(77L)).thenReturn(true);
        when(jwtService.generateToken("student@example.com", 77L, "STUDENT", List.of("STUDENT"), null))
                .thenReturn("new-access-token");

        var result = authService.refresh("old-refresh-token");

        assertThat(result.getToken()).isEqualTo("new-access-token");
        assertThat(result.getRefreshToken()).isEqualTo("new-refresh-token");
        assertThat(result.getActiveRole()).isEqualTo("STUDENT");
        verify(refreshTokenService).consumeForRefresh("old-refresh-token");
    }
}
