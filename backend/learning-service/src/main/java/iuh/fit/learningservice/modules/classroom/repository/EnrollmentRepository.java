package iuh.fit.learningservice.modules.classroom.repository;

import iuh.fit.learningservice.modules.classroom.entity.Enrollment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EnrollmentRepository extends JpaRepository<Enrollment, UUID> {
    long countByClassRoomId(UUID classRoomId);
    List<Enrollment> findByClassRoomId(UUID classRoomId);
}
