package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.enums.TutorStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TutorRepository extends JpaRepository<Tutor, Long> {

    Optional<Tutor> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    List<Tutor> findByStatus(TutorStatus status);

    @Query("""
            select tutor
            from Tutor tutor
            join fetch tutor.user user
            join TutorApplication app on app.user.id = user.id
            where user.emailVerified = true
              and app.status = iuh.fit.account_service.enums.TutorApplicationStatus.APPROVED
            order by user.fullName asc
            """)
    List<Tutor> findPublicTutors(Pageable pageable);

    @Query("""
            select tutor
            from Tutor tutor
            join fetch tutor.user user
            join TutorApplication app on app.user.id = user.id
            where user.emailVerified = true
              and app.status = iuh.fit.account_service.enums.TutorApplicationStatus.APPROVED
              and lower(user.fullName) like lower(concat('%', :keyword, '%'))
            order by user.fullName asc
            """)
    List<Tutor> findPublicTutorsByKeyword(@Param("keyword") String keyword, Pageable pageable);
}
