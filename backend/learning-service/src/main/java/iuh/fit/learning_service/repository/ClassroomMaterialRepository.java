package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.ClassroomMaterial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassroomMaterialRepository extends JpaRepository<ClassroomMaterial, Long> {

    List<ClassroomMaterial> findByClassRoom_IdOrderByCreatedAtDesc(Long classRoomId);

    long countByClassRoom_Id(Long classRoomId);
}
