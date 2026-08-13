package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.TutorApplicationSubject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TutorApplicationSubjectRepository extends JpaRepository<TutorApplicationSubject, Long> {

    List<TutorApplicationSubject> findByTutorApplication_IdOrderByCreatedAtAsc(Long tutorApplicationId);

    boolean existsByTutorApplication_IdAndSubject_Id(Long tutorApplicationId, Long subjectId);

    long countByTutorApplication_Id(Long tutorApplicationId);

    Optional<TutorApplicationSubject> findByIdAndTutorApplication_Id(Long id, Long tutorApplicationId);
}
