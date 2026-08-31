package iuh.fit.notification_service.repository;

import iuh.fit.notification_service.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc(String email, Pageable pageable);

    long countByRecipientEmailIgnoreCaseAndIsReadFalse(String email);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true, n.status = iuh.fit.notification_service.enums.NotificationStatus.READ, n.readAt = :now WHERE LOWER(n.recipientEmail) = LOWER(:email) AND n.isRead = false")
    int markAllAsReadForEmail(@Param("email") String email, @Param("now") OffsetDateTime now);
}
