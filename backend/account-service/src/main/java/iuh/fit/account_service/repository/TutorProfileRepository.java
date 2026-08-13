package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.TutorProfile;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface TutorProfileRepository extends JpaRepository<TutorProfile, Long> {

    Optional<TutorProfile> findByUserId(Long userId);

    Optional<TutorProfile> findByIdAndActiveTrue(Long id);

    boolean existsByUserId(Long userId);

    @Query("""
            select distinct profile
            from TutorProfile profile
            join profile.user user
            join profile.subjects tutorSubject
            join tutorSubject.subject subject
            where profile.active = true
              and tutorSubject.active = true
              and (:subjectId is null or subject.id = :subjectId)
              and (:keyword is null
                   or lower(user.fullName) like lower(concat('%', :keyword, '%'))
                   or lower(subject.name) like lower(concat('%', :keyword, '%')))
              and (:minRate is null or tutorSubject.oneToOneHourlyRate >= :minRate)
              and (:maxRate is null or tutorSubject.oneToOneHourlyRate <= :maxRate)
            order by user.fullName asc
            """)
    List<TutorProfile> searchPublicTutors(
            @Param("keyword") String keyword,
            @Param("subjectId") Long subjectId,
            @Param("minRate") BigDecimal minRate,
            @Param("maxRate") BigDecimal maxRate,
            Pageable pageable
    );
}
