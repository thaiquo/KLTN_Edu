package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.TerminationItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface TerminationItemRepository extends JpaRepository<TerminationItem, UUID> {
    List<TerminationItem> findByCaseIdOrderByAgreementId(UUID caseId);
}
