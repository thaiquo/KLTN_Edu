package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.LearningTerminationCommandInbox;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface LearningTerminationCommandInboxRepository extends JpaRepository<LearningTerminationCommandInbox, UUID> {
    Optional<LearningTerminationCommandInbox> findByCommandIdAndAction(UUID commandId, String action);
}
