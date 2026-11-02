package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.SettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionSettlementRepository extends JpaRepository<SessionSettlement, UUID>, JpaSpecificationExecutor<SessionSettlement> {
    List<SessionSettlement> findTop50ByStatusAndDisputeDeadlineBeforeOrderByDisputeDeadlineAsc(
            SettlementStatus status, java.time.OffsetDateTime deadline);
    Optional<SessionSettlement> findByAgreementIdAndSessionId(UUID agreementId, Long sessionId);

    Optional<SessionSettlement> findByAgreementIdAndOnchainSessionId(UUID agreementId, String onchainSessionId);

    List<SessionSettlement> findByAgreementId(UUID agreementId);

    boolean existsByAgreementIdAndStatusIn(UUID agreementId, List<SettlementStatus> statuses);

    @Query(value = """
            SELECT s FROM SessionSettlement s
            JOIN FETCH s.agreement a
            WHERE s.status = iuh.fit.contract_service.enums.SettlementStatus.PROPOSED
              AND s.outcome = iuh.fit.contract_service.enums.SettlementOutcome.BOTH_PRESENT
              AND s.disputeDeadline >= :now
              AND ((:userId IS NOT NULL AND a.studentId = :userId)
                   OR LOWER(a.studentEmail) = LOWER(:email))
              AND (:sessionId IS NULL OR s.sessionId = :sessionId)
              AND (:classroomId IS NULL OR a.classroomId = :classroomId)
            """,
            countQuery = """
            SELECT COUNT(s) FROM SessionSettlement s
            JOIN s.agreement a
            WHERE s.status = iuh.fit.contract_service.enums.SettlementStatus.PROPOSED
              AND s.outcome = iuh.fit.contract_service.enums.SettlementOutcome.BOTH_PRESENT
              AND s.disputeDeadline >= :now
              AND ((:userId IS NOT NULL AND a.studentId = :userId)
                   OR LOWER(a.studentEmail) = LOWER(:email))
              AND (:sessionId IS NULL OR s.sessionId = :sessionId)
              AND (:classroomId IS NULL OR a.classroomId = :classroomId)
            """)
    org.springframework.data.domain.Page<SessionSettlement> findEligibleStudentDisputes(
            @Param("userId") Long userId,
            @Param("email") String email,
            @Param("now") java.time.OffsetDateTime now,
            @Param("sessionId") Long sessionId,
            @Param("classroomId") Long classroomId,
            org.springframework.data.domain.Pageable pageable);
}
