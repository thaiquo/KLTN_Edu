package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.TerminationCase;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface TerminationCaseRepository extends JpaRepository<TerminationCase, UUID> {
    List<TerminationCase> findByClassroomIdOrderByCreatedAtDesc(Long classroomId);
    List<TerminationCase> findTop50ByStatusOrderByUpdatedAtAsc(String status);
    boolean existsBySignature(String signature);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from TerminationCase c where c.id = :id")
    Optional<TerminationCase> lockById(@org.springframework.data.repository.query.Param("id") UUID id);
}
