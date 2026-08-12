package iuh.fit.account_service.modules.auth.repository;

import iuh.fit.account_service.modules.auth.entity.OutboxEvent;
import iuh.fit.account_service.shared.enums.OutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    List<OutboxEvent> findAllByStatusOrderByCreatedAtAsc(OutboxStatus status);
}