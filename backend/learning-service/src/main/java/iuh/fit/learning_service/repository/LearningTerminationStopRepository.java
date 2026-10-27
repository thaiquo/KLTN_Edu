package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.LearningTerminationStop;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LearningTerminationStopRepository extends JpaRepository<LearningTerminationStop, String> {
    List<LearningTerminationStop> findByClassroomIdAndStudentId(Long classroomId, Long studentId);
    Optional<LearningTerminationStop> findByCommandId(UUID commandId);
}
