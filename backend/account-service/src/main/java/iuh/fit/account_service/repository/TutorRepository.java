package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.enums.TutorStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TutorRepository extends JpaRepository<Tutor, Long> {

    Optional<Tutor> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    List<Tutor> findByStatus(TutorStatus status);
}
