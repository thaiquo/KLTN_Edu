package iuh.fit.learningservice.modules.classroom.repository;

import iuh.fit.learningservice.modules.classroom.entity.AccountTutorProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AccountTutorProfileRepository extends JpaRepository<AccountTutorProfile, UUID> {
    Optional<AccountTutorProfile> findByUserId(UUID userId);
}
