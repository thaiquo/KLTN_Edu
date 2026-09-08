package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ContractAcceptance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContractAcceptanceRepository extends JpaRepository<ContractAcceptance, UUID> {
    List<ContractAcceptance> findByAgreementId(UUID agreementId);
    Optional<ContractAcceptance> findByAgreementIdAndUserIdAndRoleAndContractVersion(
            UUID agreementId, Long userId, String role, Integer contractVersion);
}
