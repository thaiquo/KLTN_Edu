package iuh.fit.authservice.modules.auth.repository;

import iuh.fit.authservice.modules.auth.entity.AccountProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AccountProfileRepository extends JpaRepository<AccountProfile, UUID> {

    Optional<AccountProfile> findByAccountId(UUID accountId);
}