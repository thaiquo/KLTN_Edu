package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContractAgreementRepository extends JpaRepository<ContractAgreement, UUID> {
    List<ContractAgreement> findByClassroomIdOrderByCreatedAtAsc(Long classroomId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select a from ContractAgreement a where a.id = :id")
    Optional<ContractAgreement> lockById(@org.springframework.data.repository.query.Param("id") UUID id);
    Optional<ContractAgreement> findByClassroomIdAndStudentIdAndContractVersion(
            Long classroomId,
            Long studentId,
            Integer contractVersion);

    Optional<ContractAgreement> findFirstByClassroomIdAndStudentIdOrderByCreatedAtDesc(
            Long classroomId,
            Long studentId);

    Optional<ContractAgreement> findByChainIdAndOnchainAgreementId(Long chainId, String onchainAgreementId);

    List<ContractAgreement> findByStatus(ContractAgreementStatus status);

    List<ContractAgreement> findByStatusAndPaymentDeadlineBefore(
            ContractAgreementStatus status,
            OffsetDateTime deadline);
}
