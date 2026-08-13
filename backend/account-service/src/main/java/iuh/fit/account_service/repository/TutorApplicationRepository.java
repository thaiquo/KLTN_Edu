package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TutorApplicationRepository extends JpaRepository<TutorApplication, Long> {

    Optional<TutorApplication> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    List<TutorApplication> findByStatus(TutorApplicationStatus status);
}
