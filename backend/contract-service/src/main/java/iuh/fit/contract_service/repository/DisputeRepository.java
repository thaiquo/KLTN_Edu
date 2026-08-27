package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.Dispute;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DisputeRepository extends JpaRepository<Dispute, UUID> {

    Optional<Dispute> findBySettlementId(UUID settlementId);

    @Query("SELECT d FROM Dispute d WHERE d.settlement.agreement.onchainAgreementId = :onchainAgreementId AND d.settlement.onchainSessionId = :onchainSessionId")
    Optional<Dispute> findByOnchainIdentifiers(
            @Param("onchainAgreementId") String onchainAgreementId,
            @Param("onchainSessionId") String onchainSessionId);
}
