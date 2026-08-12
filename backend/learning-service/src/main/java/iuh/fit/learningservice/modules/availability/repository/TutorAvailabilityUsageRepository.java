package iuh.fit.learningservice.modules.availability.repository;

import iuh.fit.learningservice.modules.availability.entity.TutorAvailabilityUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TutorAvailabilityUsageRepository extends JpaRepository<TutorAvailabilityUsage, UUID> {

    boolean existsByAvailabilityIdAndActiveTrue(UUID availabilityId);
}
