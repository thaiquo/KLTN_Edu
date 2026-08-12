package iuh.fit.account_service.modules.profile.repository;

import iuh.fit.account_service.modules.profile.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.Optional;

@NoRepositoryBean
public interface StudentRepository extends JpaRepository<Student, Long> {

    Optional<Student> findByUserId(Long userId);

    boolean existsByUserId(Long userId);
}
