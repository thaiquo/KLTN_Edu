package iuh.fit.account_service.modules.auth.repository;

import iuh.fit.account_service.modules.auth.entity.Session;
import iuh.fit.account_service.shared.enums.SessionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    Page<Session> findAllByAccount_IdOrderByLastActivityAtDesc(UUID accountId, Pageable pageable);

    Optional<Session> findByIdAndAccount_Id(UUID id, UUID accountId);

    List<Session> findAllByAccount_IdAndStatus(UUID accountId, SessionStatus status);
}