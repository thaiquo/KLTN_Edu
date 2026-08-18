package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CatalogSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CatalogSubjectRepository extends JpaRepository<CatalogSubject, Long> {
    List<CatalogSubject> findByCategoryIdAndActiveTrueOrderByOrderIndexAscNameAsc(Long categoryId);
    List<CatalogSubject> findByCategoryIdOrderByOrderIndexAscNameAsc(Long categoryId);
    Optional<CatalogSubject> findByIdAndActiveTrue(Long id);
    boolean existsByCategoryIdAndNameIgnoreCase(Long categoryId, String name);
    Optional<CatalogSubject> findByCategoryIdAndCodeIgnoreCase(Long categoryId, String code);
}
