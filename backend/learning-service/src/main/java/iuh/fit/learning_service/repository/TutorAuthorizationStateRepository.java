package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.TutorAuthorizationState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TutorAuthorizationStateRepository extends JpaRepository<TutorAuthorizationState, Long> {
    Optional<TutorAuthorizationState> findByTutorProfileId(Long tutorProfileId);
}
