package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.WalletOwnershipChallenge;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface WalletOwnershipChallengeRepository extends JpaRepository<WalletOwnershipChallenge, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from WalletOwnershipChallenge c where c.id = :id")
    Optional<WalletOwnershipChallenge> lockById(@Param("id") UUID id);
}
