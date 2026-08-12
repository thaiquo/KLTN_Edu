package iuh.fit.account_service.modules.tutor.repository;

import iuh.fit.account_service.modules.tutor.entity.Tutor;
import iuh.fit.account_service.modules.tutor.enums.TutorStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.List;
import java.util.Optional;

@NoRepositoryBean
public interface TutorRepository extends JpaRepository<Tutor, Long> {

    Optional<Tutor> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    List<Tutor> findByVerificationStatus(TutorStatus status);
}
