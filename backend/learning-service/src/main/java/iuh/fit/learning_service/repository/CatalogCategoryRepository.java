package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CatalogCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.List;
import java.util.Optional;

public interface CatalogCategoryRepository extends JpaRepository<CatalogCategory, Long>, JpaSpecificationExecutor<CatalogCategory> {
    List<CatalogCategory> findByProgramTypeIdAndEducationLevelIdAndActiveTrueOrderByOrderIndexAscNameAsc(Long programTypeId, Long educationLevelId);
    List<CatalogCategory> findByProgramTypeIdAndEducationLevelIsNullAndActiveTrueOrderByOrderIndexAscNameAsc(Long programTypeId);
    Optional<CatalogCategory> findFirstByCodeIgnoreCaseAndActiveTrue(String code);
    List<CatalogCategory> findAllByOrderByOrderIndexAscNameAsc();
}
