package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.EducationLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EducationLevelRepository extends JpaRepository<EducationLevel, Long> {
    List<EducationLevel> findByActiveTrueOrderByOrderIndexAscNameAsc();
    List<EducationLevel> findAllByOrderByOrderIndexAscNameAsc();
}
