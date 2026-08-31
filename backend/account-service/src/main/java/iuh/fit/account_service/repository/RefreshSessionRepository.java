package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.RefreshSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.Optional;

public interface RefreshSessionRepository extends JpaRepository<RefreshSession, Long> {

    Optional<RefreshSession> findByTokenHash(String tokenHash);

    @Modifying
    @Query("""
            update RefreshSession session
            set session.revoked = true,
                session.revokedAt = :revokedAt
            where session.user.id = :userId
              and session.revoked = false
            """)
    int revokeAllActiveByUserId(Long userId, LocalDateTime revokedAt);
}
