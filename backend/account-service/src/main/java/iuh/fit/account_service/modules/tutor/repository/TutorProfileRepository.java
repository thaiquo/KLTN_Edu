package iuh.fit.account_service.modules.tutor.repository;

import iuh.fit.account_service.modules.tutor.entity.TutorProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TutorProfileRepository extends JpaRepository<TutorProfile, UUID> {
    Optional<TutorProfile> findByUser_Id(UUID userId);
}
