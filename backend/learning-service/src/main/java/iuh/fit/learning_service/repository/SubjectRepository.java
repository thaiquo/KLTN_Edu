package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.Subject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubjectRepository extends JpaRepository<Subject, Long> {
    List<Subject> findByActiveTrueOrderByNameAsc(Pageable pageable);
    List<Subject> findByCategoryIdAndActiveTrueOrderByNameAsc(Long categoryId, Pageable pageable);
    List<Subject> findByGroupIdAndActiveTrueOrderByNameAsc(Long groupId, Pageable pageable);
    List<Subject> findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(String keyword, Pageable pageable);
    List<Subject> findByCategoryIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(Long categoryId, String keyword, Pageable pageable);
    List<Subject> findByGroupIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(Long groupId, String keyword, Pageable pageable);
    Optional<Subject> findByIdAndActiveTrue(Long id);
    boolean existsByNameIgnoreCaseAndCategoryId(String name, Long categoryId);
}
