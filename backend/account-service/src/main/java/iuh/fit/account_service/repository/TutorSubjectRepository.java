package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.TutorSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TutorSubjectRepository extends JpaRepository<TutorSubject, Long> {

    List<TutorSubject> findByTutorProfile_IdOrderByCreatedAtAsc(Long tutorProfileId);

    @Query("""
            select tutorSubject
            from TutorSubject tutorSubject
            join fetch tutorSubject.subject subject
            join fetch subject.category
            where tutorSubject.tutorProfile.id = :tutorProfileId
              and tutorSubject.active = true
            order by tutorSubject.createdAt asc
            """)
    List<TutorSubject> findActiveByTutorProfileId(@Param("tutorProfileId") Long tutorProfileId);

    @Query("""
            select tutorSubject
            from TutorSubject tutorSubject
            join fetch tutorSubject.subject subject
            join fetch subject.category
            where tutorSubject.tutorProfile.id in :tutorProfileIds
              and tutorSubject.active = true
            order by tutorSubject.createdAt asc
            """)
    List<TutorSubject> findActiveByTutorProfileIds(@Param("tutorProfileIds") List<Long> tutorProfileIds);

    Optional<TutorSubject> findByTutorProfile_IdAndSubject_Id(Long tutorProfileId, Long subjectId);

    boolean existsByTutorProfile_IdAndSubject_Id(Long tutorProfileId, Long subjectId);
}
