package iuh.fit.authservice.modules.auth.repository;

import iuh.fit.authservice.modules.auth.entity.OutboxEvent;
import iuh.fit.authservice.shared.enums.OutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    List<OutboxEvent> findAllByStatusOrderByCreatedAtAsc(OutboxStatus status);
}