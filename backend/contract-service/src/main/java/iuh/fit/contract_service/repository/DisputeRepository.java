package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.enums.DisputeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;

@Repository
public interface DisputeRepository extends JpaRepository<Dispute, UUID>, JpaSpecificationExecutor<Dispute> {

    @Override
    @EntityGraph(attributePaths = {"settlement", "settlement.agreement"})
    Page<Dispute> findAll(Specification<Dispute> specification, Pageable pageable);

    @EntityGraph(attributePaths = {"settlement", "settlement.agreement"})
    @Query("SELECT d FROM Dispute d")
    List<Dispute> findAllWithSettlementAndAgreement();

    @EntityGraph(attributePaths = {"settlement", "settlement.agreement"})
    @Query("SELECT d FROM Dispute d WHERE d.id = :id")
    Optional<Dispute> findByIdWithSettlementAndAgreement(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"settlement", "settlement.agreement"})
    @Query("SELECT d FROM Dispute d WHERE d.id = :id")
    Optional<Dispute> findByIdForUpdate(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"settlement", "settlement.agreement"})
    @Query(value = """
            SELECT d FROM Dispute d
            WHERE d.escalationStatus <> iuh.fit.contract_service.enums.DisputeEscalationStatus.NONE
              AND (:status IS NULL OR d.escalationStatus = :status)
              AND (LOWER(CAST(d.id AS string)) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(d.reason) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(d.escalationReason) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(d.settlement.agreement.className) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """,
            countQuery = """
            SELECT COUNT(d) FROM Dispute d
            WHERE d.escalationStatus <> iuh.fit.contract_service.enums.DisputeEscalationStatus.NONE
              AND (:status IS NULL OR d.escalationStatus = :status)
              AND (LOWER(CAST(d.id AS string)) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(d.reason) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(d.escalationReason) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(d.settlement.agreement.className) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<Dispute> findEscalationQueue(
            @Param("status") iuh.fit.contract_service.enums.DisputeEscalationStatus status,
            @Param("keyword") String keyword,
            Pageable pageable);

    @EntityGraph(attributePaths = {"settlement", "settlement.agreement"})
    @Query(value = """
            SELECT d FROM Dispute d
            WHERE d.escalationStatus <> iuh.fit.contract_service.enums.DisputeEscalationStatus.NONE
              AND (:status IS NULL OR d.escalationStatus = :status)
            """,
            countQuery = """
            SELECT COUNT(d) FROM Dispute d
            WHERE d.escalationStatus <> iuh.fit.contract_service.enums.DisputeEscalationStatus.NONE
              AND (:status IS NULL OR d.escalationStatus = :status)
            """)
    Page<Dispute> findEscalationQueue(
            @Param("status") iuh.fit.contract_service.enums.DisputeEscalationStatus status,
            Pageable pageable);

    Optional<Dispute> findBySettlementId(UUID settlementId);

    boolean existsBySettlement_Agreement_IdAndStatusIn(UUID agreementId, Collection<DisputeStatus> statuses);

    @Query("SELECT d FROM Dispute d WHERE d.settlement.agreement.onchainAgreementId = :onchainAgreementId AND d.settlement.onchainSessionId = :onchainSessionId")
    Optional<Dispute> findByOnchainIdentifiers(
            @Param("onchainAgreementId") String onchainAgreementId,
            @Param("onchainSessionId") String onchainSessionId);

    List<Dispute> findBySettlement_Agreement_ClassroomIdAndSettlement_SessionIdAndTutorResponseIsNotNullOrderByTutorRespondedAtDesc(
            Long classroomId, Long sessionId);

    List<Dispute> findBySettlement_Agreement_ClassroomIdAndSettlement_SessionIdAndStatus(
            Long classroomId, Long sessionId, DisputeStatus status);
}
