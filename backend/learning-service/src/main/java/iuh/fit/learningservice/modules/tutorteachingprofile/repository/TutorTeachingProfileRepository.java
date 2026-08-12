package iuh.fit.learningservice.modules.tutorteachingprofile.repository;

import iuh.fit.learningservice.modules.tutorteachingprofile.entity.TutorTeachingProfile;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TutorTeachingProfileRepository extends JpaRepository<TutorTeachingProfile, UUID> {

    @EntityGraph(attributePaths = "locations")
    Optional<TutorTeachingProfile> findByTutorId(UUID tutorId);
}
