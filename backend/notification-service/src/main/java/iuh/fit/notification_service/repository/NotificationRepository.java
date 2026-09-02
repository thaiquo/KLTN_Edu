package iuh.fit.notification_service.repository;

import iuh.fit.notification_service.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Optional<Notification> findByEventIdAndRecipientUserId(String eventId, Long recipientUserId);

    Page<Notification> findByRecipientUserId(Long recipientUserId, Pageable pageable);

    Page<Notification> findByRecipientUserIdAndReadAtIsNull(Long recipientUserId, Pageable pageable);

    Page<Notification> findByRecipientUserIdAndTargetRoleIgnoreCase(Long recipientUserId, String targetRole, Pageable pageable);

    Page<Notification> findByRecipientUserIdAndTargetRoleIgnoreCaseAndReadAtIsNull(
            Long recipientUserId,
            String targetRole,
            Pageable pageable
    );

    long countByRecipientUserIdAndReadAtIsNull(Long recipientUserId);

    long countByRecipientUserIdAndTargetRoleIgnoreCaseAndReadAtIsNull(Long recipientUserId, String targetRole);

    @Modifying
    @Query("""
            update Notification n
               set n.readAt = :readAt
             where n.recipientUserId = :recipientUserId
               and n.readAt is null
            """)
    int markAllUnreadAsRead(@Param("recipientUserId") Long recipientUserId, @Param("readAt") LocalDateTime readAt);

    @Modifying
    @Query("""
            update Notification n
               set n.readAt = :readAt
             where n.recipientUserId = :recipientUserId
               and lower(n.targetRole) = lower(:targetRole)
               and n.readAt is null
            """)
    int markAllUnreadAsReadForTargetRole(
            @Param("recipientUserId") Long recipientUserId,
            @Param("targetRole") String targetRole,
            @Param("readAt") LocalDateTime readAt
    );
}
