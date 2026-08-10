package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.Subject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubjectRepository extends JpaRepository<Subject, Long> {

    List<Subject> findByActiveTrueOrderByNameAsc();

    List<Subject> findByCategoryIdAndActiveTrueOrderByNameAsc(Long categoryId);

    List<Subject> findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(String keyword);
}
