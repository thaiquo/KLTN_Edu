package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.enums.DisputeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;

@Repository
public interface DisputeRepository extends JpaRepository<Dispute, UUID> {

    @EntityGraph(attributePaths = {"settlement", "settlement.agreement"})
    @Query("SELECT d FROM Dispute d")
    List<Dispute> findAllWithSettlementAndAgreement();

    @EntityGraph(attributePaths = {"settlement", "settlement.agreement"})
    @Query("SELECT d FROM Dispute d WHERE d.id = :id")
    Optional<Dispute> findByIdWithSettlementAndAgreement(@Param("id") UUID id);

    Optional<Dispute> findBySettlementId(UUID settlementId);

    boolean existsBySettlement_Agreement_IdAndStatusIn(UUID agreementId, Collection<DisputeStatus> statuses);

    @Query("SELECT d FROM Dispute d WHERE d.settlement.agreement.onchainAgreementId = :onchainAgreementId AND d.settlement.onchainSessionId = :onchainSessionId")
    Optional<Dispute> findByOnchainIdentifiers(
            @Param("onchainAgreementId") String onchainAgreementId,
            @Param("onchainSessionId") String onchainSessionId);
}
