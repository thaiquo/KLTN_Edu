package iuh.fit.account_service.infrastructure.config;

import iuh.fit.account_service.modules.auth.entity.Account;
import iuh.fit.account_service.modules.auth.entity.AccountProfile;
import iuh.fit.account_service.modules.auth.repository.AccountProfileRepository;
import iuh.fit.account_service.modules.auth.repository.AccountRepository;
import iuh.fit.account_service.modules.role.entity.RoleEntity;
import iuh.fit.account_service.modules.role.repository.RoleRepository;
import iuh.fit.account_service.shared.enums.AccountStatus;
import iuh.fit.account_service.shared.enums.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Component
public class AdminDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminDataInitializer.class);

    private final AccountRepository accountRepository;
    private final AccountProfileRepository accountProfileRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminDataInitializer(AccountRepository accountRepository,
                                 AccountProfileRepository accountProfileRepository,
                                 RoleRepository roleRepository,
                                 PasswordEncoder passwordEncoder) {
        this.accountRepository = accountRepository;
        this.accountProfileRepository = accountProfileRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        RoleEntity adminRole = roleRepository.findByName(Role.ADMIN)
            .orElseGet(() -> roleRepository.save(new RoleEntity(Role.ADMIN)));
        RoleEntity staffRole = roleRepository.findByName(Role.STAFF)
            .orElseGet(() -> roleRepository.save(new RoleEntity(Role.STAFF)));

        String adminEmail = "ngocquocthai.004@gmail.com";
        if (accountRepository.findByEmailIgnoreCase(adminEmail).isPresent()) {
            Account account = accountRepository.findByEmailIgnoreCase(adminEmail).get();
            account.assignRole(adminRole, null);
            account.assignRole(staffRole, null);
            account.setFailedLoginCount(0);
            account.setLockedUntil(null);
            accountRepository.save(account);
            log.info("Ensured ADMIN and STAFF roles for existing account: {}", adminEmail);
        } else {
            Account account = new Account();
            account.setEmail(adminEmail);
            account.setPasswordHash(passwordEncoder.encode("tt11qq22@@"));
            account.setStatus(AccountStatus.ACTIVE);
            account.setEmailVerifiedAt(Instant.now());
            account.assignRole(adminRole, null);
            account.assignRole(staffRole, null);
            account = accountRepository.save(account);

            AccountProfile profile = new AccountProfile();
            profile.setAccount(account);
            profile.setFullName("System Administrator");
            profile.setPhone("0987654321");
            accountProfileRepository.save(profile);

            log.info("Successfully seeded and created default ADMIN and STAFF account: {}", adminEmail);
        }
    }
}
