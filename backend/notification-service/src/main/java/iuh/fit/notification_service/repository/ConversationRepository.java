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

    @Query("SELECT c FROM Conversation c WHERE LOWER(c.participant1Email) = LOWER(:email) OR LOWER(c.participant2Email) = LOWER(:email) ORDER BY c.updatedAt DESC")
    List<Conversation> findByUserEmail(@Param("email") String email);

    @Query("SELECT c FROM Conversation c WHERE (LOWER(c.participant1Email) = LOWER(:email1) AND LOWER(c.participant2Email) = LOWER(:email2)) OR (LOWER(c.participant1Email) = LOWER(:email2) AND LOWER(c.participant2Email) = LOWER(:email1))")
    Optional<Conversation> findBetweenUsers(@Param("email1") String email1, @Param("email2") String email2);
}
