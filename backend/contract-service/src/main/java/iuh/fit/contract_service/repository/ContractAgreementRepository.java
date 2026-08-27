package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ContractAgreement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ContractAgreementRepository extends JpaRepository<ContractAgreement, UUID> {
    Optional<ContractAgreement> findByClassroomIdAndStudentIdAndContractVersion(
            Long classroomId,
            Long studentId,
            Integer contractVersion);

    Optional<ContractAgreement> findByChainIdAndOnchainAgreementId(Long chainId, String onchainAgreementId);
}
