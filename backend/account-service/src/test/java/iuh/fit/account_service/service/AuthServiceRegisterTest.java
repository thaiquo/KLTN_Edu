package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.JwtService;
import iuh.fit.account_service.dto.auth.RegisterRequest;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.repository.OtpVerificationRepository;
import iuh.fit.account_service.repository.StudentRepository;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceRegisterTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final OtpVerificationRepository otpRepository = mock(OtpVerificationRepository.class);
    private final TutorRepository tutorRepository = mock(TutorRepository.class);
    private final TutorApplicationRepository tutorApplicationRepository = mock(TutorApplicationRepository.class);
    private final OtpService otpService = mock(OtpService.class);
    private final AuthService authService = new AuthService(
            userRepository,
            userRoleRepository,
            studentRepository,
            tutorRepository,
            tutorApplicationRepository,
            otpRepository,
            new BCryptPasswordEncoder(),
            otpService,
            mock(AuthenticationManager.class),
            mock(JwtService.class),
            mock(RefreshTokenService.class)
    );

    @Test
    void registerCreatesUserWithNormalizedEmailStudentRoleAndOtp() {
        RegisterRequest request = validRequest();
        request.setFullName("  Nguyen Van A  ");
        request.setEmail("  Test.User@GMAIL.com  ");
        when(userRepository.existsByEmailIgnoreCase("test.user@gmail.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            ReflectionTestUtils.setField(user, "id", 123L);
            return user;
        });

        var response = authService.register(request);

        assertThat(response.getUserId()).isEqualTo(123L);
        assertThat(response.getEmail()).isEqualTo("test.user@gmail.com");

        var userCaptor = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertThat(savedUser.getEmail()).isEqualTo("test.user@gmail.com");
        assertThat(savedUser.getFullName()).isEqualTo("Nguyen Van A");
        assertThat(savedUser.getPassword()).isNotEqualTo("12345678");
        assertThat(new BCryptPasswordEncoder().matches("12345678", savedUser.getPassword())).isTrue();
        assertThat(savedUser.isEmailVerified()).isFalse();
        assertThat(ReflectionTestUtils.getField(savedUser, "accountStatus")).isEqualTo(AccountStatus.ACTIVE);

        var roleCaptor = org.mockito.ArgumentCaptor.forClass(UserRole.class);
        verify(userRoleRepository).save(roleCaptor.capture());
        assertThat(roleCaptor.getValue().getUser()).isSameAs(savedUser);
        assertThat(roleCaptor.getValue().getRole()).isEqualTo(Role.STUDENT);

        verify(otpService).generateAndSendEmailVerificationOtp(savedUser);
    }

    @Test
    void registerRequestSupportsRoleField() {
        assertThat(hasField("role")).isTrue();
        assertThat(hasField("userType")).isFalse();
    }

    @Test
    void tutorRegisterCreatesTutorRoleProfileAndDraftApplication() {
        RegisterRequest request = validRequest();
        request.setRole("TUTOR");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            ReflectionTestUtils.setField(user, "id", 501L);
            return user;
        });

        var response = authService.register(request);

        assertThat(response.getUserId()).isEqualTo(501L);

        var applicationCaptor = org.mockito.ArgumentCaptor.forClass(TutorApplication.class);
        verify(tutorApplicationRepository).save(applicationCaptor.capture());
        assertThat(applicationCaptor.getValue().getUser().getId()).isEqualTo(501L);
        assertThat(applicationCaptor.getValue().getStatus()).isEqualTo(TutorApplicationStatus.DRAFT);
    }

    @Test
    void verifiedDuplicateEmailIsCheckedCaseInsensitively() {
        RegisterRequest request = validRequest();
        request.setEmail("TEST@gmail.com");
        User existingUser = new User();
        existingUser.setEmail("test@gmail.com");
        existingUser.setEmailVerified(true);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(existingUser));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Email already exists");

        verify(userRepository, never()).save(any(User.class));
        verify(userRoleRepository, never()).save(any(UserRole.class));
        verify(otpService, never()).generateAndSendEmailVerificationOtp(any(User.class));
    }

    @Test
    void pendingRegistrationResendsOtpWithoutCreatingDuplicateUser() {
        RegisterRequest request = validRequest();
        request.setEmail(" TEST@gmail.com ");
        request.setFullName(" Updated Name ");
        User existingUser = new User();
        ReflectionTestUtils.setField(existingUser, "id", 44L);
        existingUser.setEmail("test@gmail.com");
        existingUser.setEmailVerified(false);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(existingUser));
        when(userRoleRepository.existsByUserIdAndRole(44L, Role.STUDENT)).thenReturn(true);

        var response = authService.register(request);

        assertThat(response.getUserId()).isEqualTo(44L);
        assertThat(response.getEmail()).isEqualTo("test@gmail.com");
        assertThat(existingUser.getFullName()).isEqualTo("Updated Name");
        assertThat(new BCryptPasswordEncoder().matches("12345678", existingUser.getPassword())).isTrue();
        verify(userRepository).save(existingUser);
        verify(userRoleRepository, never()).save(any(UserRole.class));
        verify(otpService).resendEmailVerificationOtp(existingUser);
        verify(otpService, never()).generateAndSendEmailVerificationOtp(any(User.class));
    }

    @Test
    void passwordMismatchReturnsBadRequestException() {
        RegisterRequest request = validRequest();
        request.setConfirmPassword("87654321");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Passwords do not match");

        verify(userRepository, never()).save(any(User.class));
        verify(userRoleRepository, never()).save(any(UserRole.class));
        verify(otpService, never()).generateAndSendEmailVerificationOtp(any(User.class));
    }

    private RegisterRequest validRequest() {
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Nguyen Van A");
        request.setEmail("test@gmail.com");
        request.setPassword("12345678");
        request.setConfirmPassword("12345678");
        return request;
    }

    private boolean hasField(String fieldName) {
        for (Field field : RegisterRequest.class.getDeclaredFields()) {
            if (field.getName().equals(fieldName)) {
                return true;
            }
        }
        return false;
    }
}
