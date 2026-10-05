package iuh.fit.notification_service.repository;

import iuh.fit.notification_service.entity.ChatAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ChatAttachmentRepository extends JpaRepository<ChatAttachment, UUID> {
}
