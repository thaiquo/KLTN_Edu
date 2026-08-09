package iuh.fit.authservice.modules.auth.repository;

import iuh.fit.authservice.modules.auth.entity.Account;
import iuh.fit.authservice.shared.enums.AccountStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    Optional<Account> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    Page<Account> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Account> findAllByStatusOrderByCreatedAtDesc(AccountStatus status, Pageable pageable);
}