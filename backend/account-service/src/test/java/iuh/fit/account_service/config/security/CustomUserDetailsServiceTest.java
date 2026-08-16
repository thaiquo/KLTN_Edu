package iuh.fit.account_service.config.security;

import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CustomUserDetailsServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final iuh.fit.account_service.repository.StudentRepository studentRepository = mock(iuh.fit.account_service.repository.StudentRepository.class);
    private final iuh.fit.account_service.repository.TutorRepository tutorRepository = mock(iuh.fit.account_service.repository.TutorRepository.class);
    private final CustomUserDetailsService service = new CustomUserDetailsService(
            userRepository,
            userRoleRepository,
            studentRepository,
            tutorRepository
    );

    @Test
    void activeVerifiedUserHasAllAuthoritiesAndAllowedFlags() {
        User user = user(AccountStatus.ACTIVE, true);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(1L)).thenReturn(List.of(
                role(user, Role.STUDENT),
                role(user, Role.TUTOR)
        ));

        var details = service.loadUserByUsername("test@gmail.com");

        assertThat(details.isEnabled()).isTrue();
        assertThat(details.isAccountNonLocked()).isTrue();
        assertThat(details.getAuthorities())
                .extracting(Object::toString)
                .containsExactly("ROLE_STUDENT", "ROLE_TUTOR");
    }

    @Test
    void staffOnlyUserHasOnlyStaffAuthority() {
        User user = user(AccountStatus.ACTIVE, true);
        when(userRepository.findByEmailIgnoreCase("staff@gmail.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(1L)).thenReturn(List.of(role(user, Role.STAFF)));

        var details = service.loadUserByUsername("staff@gmail.com");

        assertThat(details.getAuthorities())
                .extracting(Object::toString)
                .containsExactly("ROLE_STAFF");
    }

    @Test
    void disabledUserIsNotEnabledForJwtReuse() {
        User user = user(AccountStatus.DISABLED, true);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(1L)).thenReturn(List.of(role(user, Role.STUDENT)));

        var details = service.loadUserByUsername("test@gmail.com");

        assertThat(details.isEnabled()).isFalse();
    }

    @Test
    void lockedUserIsAccountLockedForJwtReuse() {
        User user = user(AccountStatus.LOCKED, true);
        when(userRepository.findByEmailIgnoreCase("test@gmail.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(1L)).thenReturn(List.of(role(user, Role.STUDENT)));

        var details = service.loadUserByUsername("test@gmail.com");

        assertThat(details.isAccountNonLocked()).isFalse();
    }

    private User user(AccountStatus status, boolean emailVerified) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 1L);
        user.setEmail("test@gmail.com");
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
