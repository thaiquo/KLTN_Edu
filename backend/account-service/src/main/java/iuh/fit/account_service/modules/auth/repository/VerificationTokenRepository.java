package iuh.fit.account_service.modules.auth.repository;

import iuh.fit.account_service.modules.auth.entity.VerificationToken;
import iuh.fit.account_service.shared.enums.VerificationStatus;
import iuh.fit.account_service.shared.enums.VerificationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VerificationTokenRepository extends JpaRepository<VerificationToken, UUID> {

    Optional<VerificationToken> findByTokenHashAndStatus(String tokenHash, VerificationStatus status);

    List<VerificationToken> findAllByAccount_IdAndTypeAndStatus(UUID accountId, VerificationType type, VerificationStatus status);
}