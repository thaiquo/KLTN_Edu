package iuh.fit.learningservice.modules.classroom.repository;

import iuh.fit.learningservice.modules.classroom.entity.ClassSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ClassScheduleRepository extends JpaRepository<ClassSchedule, UUID> {
    List<ClassSchedule> findByClassRoomId(UUID classRoomId);
}
