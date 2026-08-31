package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.TutorSubject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TutorSubjectRepository extends JpaRepository<TutorSubject, Long> {
    List<TutorSubject> findByTutorProfileIdOrderByCreatedAtAsc(Long tutorProfileId);
    List<TutorSubject> findByTutorProfileIdAndActiveTrueOrderByCreatedAtAsc(Long tutorProfileId);
    List<TutorSubject> findByUserIdAndActiveTrueOrderByCreatedAtAsc(Long userId);
    List<TutorSubject> findByTutorProfileIdInAndActiveTrueOrderByCreatedAtAsc(List<Long> tutorProfileIds);
    Optional<TutorSubject> findByTutorProfileIdAndSubjectId(Long tutorProfileId, Long subjectId);
}
