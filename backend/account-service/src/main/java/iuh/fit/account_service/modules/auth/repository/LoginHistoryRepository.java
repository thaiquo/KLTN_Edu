package iuh.fit.account_service.modules.auth.repository;

import iuh.fit.account_service.modules.auth.entity.LoginHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LoginHistoryRepository extends JpaRepository<LoginHistory, UUID> {

    Page<LoginHistory> findAllByAccount_IdOrderByLoginTimeDesc(UUID accountId, Pageable pageable);
}