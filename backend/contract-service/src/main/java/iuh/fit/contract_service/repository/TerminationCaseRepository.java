package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.TerminationCase;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface TerminationCaseRepository extends JpaRepository<TerminationCase, UUID>, JpaSpecificationExecutor<TerminationCase> {
    List<TerminationCase> findByClassroomIdOrderByCreatedAtDesc(Long classroomId);
    List<TerminationCase> findTop50ByStatusOrderByUpdatedAtAsc(String status);
    Optional<TerminationCase> findByDetectionKey(String detectionKey);
    boolean existsBySignature(String signature);
    @Query("""
            select c from TerminationCase c
            where upper(c.status) not in ('REJECTED', 'COMPLETED')
              and (c.anchorAgreementId in :agreementIds
                   or c.id in (select i.caseId from TerminationItem i where i.agreementId in :agreementIds)
                   or (c.wholeClass = true and c.classroomId in (
                       select a.classroomId from ContractAgreement a where a.id in :agreementIds)))
            """)
    List<TerminationCase> findActiveForAgreementIds(
            @org.springframework.data.repository.query.Param("agreementIds") Collection<UUID> agreementIds);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from TerminationCase c where c.id = :id")
    Optional<TerminationCase> lockById(@org.springframework.data.repository.query.Param("id") UUID id);
}
