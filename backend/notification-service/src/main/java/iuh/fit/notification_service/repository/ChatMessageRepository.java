package iuh.fit.notification_service.repository;

import iuh.fit.notification_service.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    Page<ChatMessage> findByConversationIdOrderByCreatedAtDescIdDesc(UUID conversationId, Pageable pageable);

    long countByConversationIdAndRecipientIdAndIsReadFalse(UUID conversationId, Long recipientId);

    @Modifying
    @Query("UPDATE ChatMessage m SET m.isRead = true WHERE m.conversationId = :conversationId AND m.recipientId = :recipientId AND m.isRead = false")
    int markMessagesAsReadByRecipientId(@Param("conversationId") UUID conversationId, @Param("recipientId") Long recipientId);
}
