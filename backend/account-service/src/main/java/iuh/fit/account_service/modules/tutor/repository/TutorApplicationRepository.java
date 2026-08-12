package iuh.fit.account_service.modules.tutor.repository;

import iuh.fit.account_service.modules.tutor.entity.TutorApplication;
import iuh.fit.account_service.modules.tutor.enums.TutorApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TutorApplicationRepository extends JpaRepository<TutorApplication, UUID> {
    Optional<TutorApplication> findByIdAndUser_Id(UUID id, UUID userId);
    Optional<TutorApplication> findFirstByUser_IdAndStatusInOrderByCreatedAtDesc(UUID userId, Collection<TutorApplicationStatus> statuses);
    Page<TutorApplication> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<TutorApplication> findAllByUser_IdOrderByCreatedAtDesc(UUID userId);
}
