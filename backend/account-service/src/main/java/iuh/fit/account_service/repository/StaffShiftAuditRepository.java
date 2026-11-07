package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.StaffShiftAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StaffShiftAuditRepository extends JpaRepository<StaffShiftAudit, Long> {
    List<StaffShiftAudit> findByAssignmentIdOrderByCreatedAtDesc(Long assignmentId);
    Page<StaffShiftAudit> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
