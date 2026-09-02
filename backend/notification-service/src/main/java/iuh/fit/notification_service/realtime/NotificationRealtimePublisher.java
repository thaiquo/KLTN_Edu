package iuh.fit.notification_service.realtime;

import iuh.fit.notification_service.entity.Notification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class NotificationRealtimePublisher {
    private static final Logger log = LoggerFactory.getLogger(NotificationRealtimePublisher.class);

    private final NotificationRealtimeHub notificationRealtimeHub;

    public NotificationRealtimePublisher(NotificationRealtimeHub notificationRealtimeHub) {
        this.notificationRealtimeHub = notificationRealtimeHub;
    }

    public void publishCreated(Notification notification) {
        if (notification == null || notification.getRecipientUserId() == null) {
            return;
        }

        Runnable action = () -> {
            try {
                notificationRealtimeHub.publishToUser(notification.getRecipientUserId(), toEvent(notification));
            } catch (Exception ex) {
                log.warn("Notification realtime publish failed notificationId={}", notification.getId(), ex);
            }
        };

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private NotificationRealtimeEvent toEvent(Notification notification) {
        return new NotificationRealtimeEvent(
                "notification-service",
                "NOTIFICATION_CREATED",
                notification.getId(),
                notification.getType(),
                notification.getRecipientUserId(),
                notification.getTargetRole(),
                notification.getReferenceType(),
                notification.getReferenceId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getCreatedAt()
        );
    }
}
