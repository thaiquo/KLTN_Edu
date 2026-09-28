package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CatalogSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface CatalogSubjectRepository extends JpaRepository<CatalogSubject, Long> {
    List<CatalogSubject> findByCategoryIdAndActiveTrueOrderByOrderIndexAscNameAsc(Long categoryId);
    List<CatalogSubject> findByCategoryIdOrderByOrderIndexAscNameAsc(Long categoryId);
    Optional<CatalogSubject> findByIdAndActiveTrue(Long id);
    boolean existsByCategoryIdAndNameIgnoreCase(Long categoryId, String name);
    Optional<CatalogSubject> findByCategoryIdAndCodeIgnoreCase(Long categoryId, String code);

    @Query("""
            select subject
            from CatalogSubject subject
            join fetch subject.category category
            join fetch category.programType programType
            left join fetch category.educationLevel educationLevel
            where subject.active = true
              and category.active = true
              and programType.active = true
              and (educationLevel is null or educationLevel.active = true)
            order by category.orderIndex asc, category.name asc, subject.orderIndex asc, subject.name asc
            """)
    List<CatalogSubject> findActiveGroundingSubjects();
}
