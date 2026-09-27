package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.TerminationEvidence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TerminationEvidenceRepository extends JpaRepository<TerminationEvidence, UUID> {
    List<TerminationEvidence> findByTerminationCaseIdOrderByCreatedAtAsc(UUID caseId);
    long countByTerminationCaseIdAndSubmittedByUserId(UUID caseId, Long userId);
}
