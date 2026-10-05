package iuh.fit.notification_service.repository;

import iuh.fit.notification_service.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    @Query("SELECT c FROM Conversation c WHERE c.participant1Id = :userId OR c.participant2Id = :userId ORDER BY c.updatedAt DESC")
    List<Conversation> findByParticipantUserId(@Param("userId") Long userId);

    Optional<Conversation> findByParticipantLowUserIdAndParticipantHighUserId(Long participantLowUserId, Long participantHighUserId);
}
