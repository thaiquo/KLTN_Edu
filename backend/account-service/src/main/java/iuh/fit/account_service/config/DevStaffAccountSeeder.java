package iuh.fit.account_service.config;

import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev")
public class DevStaffAccountSeeder implements ApplicationRunner {

    private static final String DEFAULT_PASSWORD = "12345678";
    private static final StaffSeed[] STAFF = {
            new StaffSeed("tanthinh@gmail.com", "Tan Thinh"),
            new StaffSeed("quocthai@gmail.com", "Quoc Thai"),
            new StaffSeed("tanquoc@gmail.com", "Tan Quoc")
    };

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    public DevStaffAccountSeeder(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (StaffSeed staff : STAFF) {
            seedStaff(staff);
        }
    }

    private void seedStaff(StaffSeed seed) {
        String email = EmailNormalizer.normalize(seed.email());
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseGet(() -> {
                    User nextUser = new User();
                    nextUser.setEmail(email);
                    nextUser.setFullName(seed.fullName());
                    nextUser.setPassword(passwordEncoder.encode(DEFAULT_PASSWORD));
                    return nextUser;
                });

        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);
        user = userRepository.save(user);

        if (!userRoleRepository.existsByUserIdAndRole(user.getId(), Role.STAFF)) {
            UserRole role = new UserRole();
            role.setUser(user);
            role.setRole(Role.STAFF);
            userRoleRepository.save(role);
        }
    }

    private record StaffSeed(String email, String fullName) {
    }
}
