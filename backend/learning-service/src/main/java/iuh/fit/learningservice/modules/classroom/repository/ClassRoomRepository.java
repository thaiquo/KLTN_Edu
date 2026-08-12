package iuh.fit.learningservice.modules.classroom.repository;

import iuh.fit.learningservice.modules.classroom.entity.ClassRoom;
import iuh.fit.learningservice.modules.classroom.entity.ClassRoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ClassRoomRepository extends JpaRepository<ClassRoom, UUID> {

    List<ClassRoom> findByTutorIdOrderByCreatedAtDesc(UUID tutorId);

    List<ClassRoom> findByTutorIdAndStatusIn(UUID tutorId, List<ClassRoomStatus> statuses);

    List<ClassRoom> findAllByOrderByCreatedAtDesc();
}
