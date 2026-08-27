package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.SessionSettlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionSettlementRepository extends JpaRepository<SessionSettlement, UUID> {
    Optional<SessionSettlement> findByAgreementIdAndSessionId(UUID agreementId, Long sessionId);

    Optional<SessionSettlement> findByAgreementIdAndOnchainSessionId(UUID agreementId, String onchainSessionId);

    List<SessionSettlement> findByAgreementId(UUID agreementId);
}
