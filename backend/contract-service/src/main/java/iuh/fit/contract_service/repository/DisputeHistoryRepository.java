package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.DisputeHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DisputeHistoryRepository extends JpaRepository<DisputeHistory, UUID> {
    List<DisputeHistory> findByDisputeIdOrderByCreatedAtAscIdAsc(UUID disputeId);

    Optional<DisputeHistory> findByIdempotencyKey(String idempotencyKey);
}
