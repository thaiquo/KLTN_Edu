package iuh.fit.authservice.modules.auth.repository;

import iuh.fit.authservice.modules.auth.entity.VerificationToken;
import iuh.fit.authservice.shared.enums.VerificationStatus;
import iuh.fit.authservice.shared.enums.VerificationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VerificationTokenRepository extends JpaRepository<VerificationToken, UUID> {

    Optional<VerificationToken> findByTokenHashAndStatus(String tokenHash, VerificationStatus status);

    List<VerificationToken> findAllByAccount_IdAndTypeAndStatus(UUID accountId, VerificationType type, VerificationStatus status);
}