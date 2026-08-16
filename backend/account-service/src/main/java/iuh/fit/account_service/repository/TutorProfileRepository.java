package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.TutorProfile;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TutorProfileRepository extends JpaRepository<TutorProfile, Long> {

    Optional<TutorProfile> findByUserId(Long userId);

    Optional<TutorProfile> findByIdAndActiveTrue(Long id);

    boolean existsByUserId(Long userId);

    @Query("""
            select profile
            from TutorProfile profile
            join profile.user user
            where profile.active = true
            order by user.fullName asc
            """)
    List<TutorProfile> findPublicTutors(
            Pageable pageable
    );

    @Query("""
            select profile
            from TutorProfile profile
            join profile.user user
            where profile.active = true
              and lower(user.fullName) like lower(concat('%', :keyword, '%'))
            order by user.fullName asc
            """)
    List<TutorProfile> findPublicTutorsByKeyword(
            @Param("keyword") String keyword,
            Pageable pageable
    );
}
