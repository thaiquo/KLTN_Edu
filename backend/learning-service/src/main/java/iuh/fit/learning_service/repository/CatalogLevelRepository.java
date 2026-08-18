package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CatalogLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CatalogLevelRepository extends JpaRepository<CatalogLevel, Long> {
    List<CatalogLevel> findBySubjectIdAndActiveTrueOrderByOrderIndexAscNameAsc(Long subjectId);
    List<CatalogLevel> findBySubjectIdOrderByOrderIndexAscNameAsc(Long subjectId);
    Optional<CatalogLevel> findByIdAndActiveTrue(Long id);
}
