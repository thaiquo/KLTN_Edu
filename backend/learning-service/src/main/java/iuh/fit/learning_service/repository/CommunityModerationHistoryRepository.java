package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CommunityModerationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CommunityModerationHistoryRepository extends JpaRepository<CommunityModerationHistory, Long> {
    List<CommunityModerationHistory> findByPostIdOrderByCreatedAtAscIdAsc(Long postId);
    Optional<CommunityModerationHistory> findTopByPostIdAndActionOrderByCreatedAtDescIdDesc(Long postId, String action);
}
