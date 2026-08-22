package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.ProgramType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProgramTypeRepository extends JpaRepository<ProgramType, Long> {
    List<ProgramType> findByActiveTrueOrderByOrderIndexAscNameAsc();
    List<ProgramType> findAllByOrderByOrderIndexAscNameAsc();
}
