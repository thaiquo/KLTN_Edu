package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.SubjectGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubjectGroupRepository extends JpaRepository<SubjectGroup, Long> {

    List<SubjectGroup> findByActiveTrueOrderByNameAsc();

    List<SubjectGroup> findByCategoryIdAndActiveTrueOrderByNameAsc(Long categoryId);

    Optional<SubjectGroup> findByIdAndActiveTrue(Long id);
}
