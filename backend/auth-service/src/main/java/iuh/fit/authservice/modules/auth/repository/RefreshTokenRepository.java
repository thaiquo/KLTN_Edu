package iuh.fit.authservice.modules.auth.repository;

import iuh.fit.authservice.modules.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findAllBySession_Id(UUID sessionId);

    List<RefreshToken> findAllByAccount_Id(UUID accountId);

    List<RefreshToken> findAllByFamilyId(UUID familyId);

    List<RefreshToken> findAllByExpiredAtBefore(Instant now);
}