package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.LearningTerminationStop;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LearningTerminationStopRepository extends JpaRepository<LearningTerminationStop, String> {
    List<LearningTerminationStop> findByClassroomIdAndStudentId(Long classroomId, Long studentId);
}
