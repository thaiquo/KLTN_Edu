package iuh.fit.notification_service.repository;

import iuh.fit.notification_service.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    List<ChatMessage> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    Page<ChatMessage> findByConversationIdOrderByCreatedAtDesc(UUID conversationId, Pageable pageable);

    long countByRecipientEmailIgnoreCaseAndIsReadFalse(String email);

    @Modifying
    @Query("UPDATE ChatMessage m SET m.isRead = true WHERE m.conversationId = :conversationId AND LOWER(m.recipientEmail) = LOWER(:email) AND m.isRead = false")
    int markMessagesAsRead(@Param("conversationId") UUID conversationId, @Param("email") String email);
}
