package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.SettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionSettlementRepository extends JpaRepository<SessionSettlement, UUID> {
    List<SessionSettlement> findTop50ByStatusAndDisputeDeadlineBeforeOrderByDisputeDeadlineAsc(
            SettlementStatus status, java.time.OffsetDateTime deadline);
    Optional<SessionSettlement> findByAgreementIdAndSessionId(UUID agreementId, Long sessionId);

    Optional<SessionSettlement> findByAgreementIdAndOnchainSessionId(UUID agreementId, String onchainSessionId);

    List<SessionSettlement> findByAgreementId(UUID agreementId);

    boolean existsByAgreementIdAndStatusIn(UUID agreementId, List<SettlementStatus> statuses);
}
