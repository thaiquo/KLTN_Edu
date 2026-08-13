package iuh.fit.account_service.config;

import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DevStaffAccountSeederTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final DevStaffAccountSeeder seeder = new DevStaffAccountSeeder(userRepository, userRoleRepository, passwordEncoder);

    @Test
    void seedCreatesVerifiedActiveStaffWithBcryptPassword() {
        when(userRepository.findByEmailIgnoreCase("tanthinh@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("quocthai@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("tanquoc@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.save(org.mockito.ArgumentMatchers.any(User.class)))
                .thenAnswer(invocation -> {
                    User user = invocation.getArgument(0);
                    if (user.getId() == null) {
                        ReflectionTestUtils.setField(user, "id", Math.abs(user.getEmail().hashCode()) + 1L);
                    }
                    return user;
                });

        seeder.run(null);

        verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(user ->
                "tanthinh@gmail.com".equals(user.getEmail())
                        && passwordEncoder.matches("12345678", user.getPassword())
                        && user.isEmailVerified()
                        && user.getAccountStatus() == AccountStatus.ACTIVE
        ));
        verify(userRoleRepository, org.mockito.Mockito.times(3)).save(org.mockito.ArgumentMatchers.argThat(role ->
                role.getRole() == Role.STAFF
        ));
    }

    @Test
    void seedExistingUserAddsMissingStaffRoleWithoutDuplicatingUserRole() {
        User existing = new User();
        ReflectionTestUtils.setField(existing, "id", 7L);
        existing.setEmail("tanthinh@gmail.com");
        existing.setFullName("Tan Thinh");
        existing.setPassword(passwordEncoder.encode("old-password"));
        when(userRepository.findByEmailIgnoreCase("tanthinh@gmail.com")).thenReturn(Optional.of(existing));
        when(userRepository.findByEmailIgnoreCase("quocthai@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("tanquoc@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.save(org.mockito.ArgumentMatchers.any(User.class)))
                .thenAnswer(invocation -> {
                    User user = invocation.getArgument(0);
                    if (user.getId() == null) {
                        ReflectionTestUtils.setField(user, "id", Math.abs(user.getEmail().hashCode()) + 1L);
                    }
                    return user;
                });
        when(userRoleRepository.existsByUserIdAndRole(7L, Role.STAFF)).thenReturn(false);

        seeder.run(null);

        assertThat(existing.isEmailVerified()).isTrue();
        assertThat(existing.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
        verify(userRoleRepository).save(org.mockito.ArgumentMatchers.argThat((UserRole role) ->
                role.getUser() == existing && role.getRole() == Role.STAFF
        ));
    }
}
