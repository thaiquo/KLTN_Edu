package iuh.fit.account_service.messaging.event;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record StaffRosterPublishedEvent(
        String eventId,
        Long recipientUserId,
        LocalDate weekStartDate,
        LocalDate weekEndDate,
        LocalDateTime occurredAt
) {}
