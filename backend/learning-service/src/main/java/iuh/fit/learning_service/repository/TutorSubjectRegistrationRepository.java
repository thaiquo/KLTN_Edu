package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.TutorSubjectRegistration;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TutorSubjectRegistrationRepository extends JpaRepository<TutorSubjectRegistration, Long> {
    List<TutorSubjectRegistration> findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(String tutorEmail);
    List<TutorSubjectRegistration> findByStatusOrderBySubmittedAtAsc(TutorSubjectRegistrationStatus status);
    List<TutorSubjectRegistration> findByStatusInOrderByReviewedAtDesc(Collection<TutorSubjectRegistrationStatus> statuses);
    Optional<TutorSubjectRegistration> findByIdAndTutorEmailIgnoreCase(Long id, String tutorEmail);
    @Query("""
            select case when count(registration) > 0 then true else false end
            from TutorSubjectRegistration registration
            join registration.levels level
            where lower(registration.tutorEmail) = lower(:tutorEmail)
              and registration.subject.id = :subjectId
              and level.id in :levelIds
              and registration.status in :statuses
            """)
    boolean existsActiveLevelOverlap(
            @Param("tutorEmail") String tutorEmail,
            @Param("subjectId") Long subjectId,
            @Param("levelIds") Collection<Long> levelIds,
            @Param("statuses") Collection<TutorSubjectRegistrationStatus> statuses);
}
