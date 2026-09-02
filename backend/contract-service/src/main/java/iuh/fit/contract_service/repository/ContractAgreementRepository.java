package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContractAgreementRepository extends JpaRepository<ContractAgreement, UUID> {
    Optional<ContractAgreement> findByClassroomIdAndStudentIdAndContractVersion(
            Long classroomId,
            Long studentId,
            Integer contractVersion);

    Optional<ContractAgreement> findFirstByClassroomIdAndStudentIdOrderByCreatedAtDesc(
            Long classroomId,
            Long studentId);

    Optional<ContractAgreement> findByChainIdAndOnchainAgreementId(Long chainId, String onchainAgreementId);

    List<ContractAgreement> findByStatusAndPaymentDeadlineBefore(
            ContractAgreementStatus status,
            OffsetDateTime deadline);
}
