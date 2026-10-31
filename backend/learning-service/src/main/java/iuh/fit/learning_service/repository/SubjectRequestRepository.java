package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.SubjectRequest;
import iuh.fit.learning_service.enums.SubjectRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface SubjectRequestRepository extends JpaRepository<SubjectRequest, Long> {
    List<SubjectRequest> findByRequestedByUserIdOrderByCreatedAtDesc(Long userId);
    List<SubjectRequest> findByStatusOrderByCreatedAtAsc(SubjectRequestStatus status);
    Page<SubjectRequest> findByStatus(SubjectRequestStatus status, Pageable pageable);
}
