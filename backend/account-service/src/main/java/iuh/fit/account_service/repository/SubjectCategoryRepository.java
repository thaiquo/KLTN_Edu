package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.SubjectCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SubjectCategoryRepository extends JpaRepository<SubjectCategory, Long> {

    Optional<SubjectCategory> findByName(String name);
}
