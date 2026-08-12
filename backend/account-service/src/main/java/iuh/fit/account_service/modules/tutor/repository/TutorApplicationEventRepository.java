package iuh.fit.account_service.modules.tutor.repository;

import iuh.fit.account_service.modules.tutor.entity.TutorApplicationEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface TutorApplicationEventRepository extends JpaRepository<TutorApplicationEvent, UUID> {
    List<TutorApplicationEvent> findByTutorApplication_IdOrderByCreatedAtAsc(UUID applicationId);
}
