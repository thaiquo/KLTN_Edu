package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ContractDocumentArtifact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ContractDocumentArtifactRepository extends JpaRepository<ContractDocumentArtifact, UUID> {
    Optional<ContractDocumentArtifact> findByAgreementIdAndContractVersion(UUID agreementId, Integer contractVersion);
}
