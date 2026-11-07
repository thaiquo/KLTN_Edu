package iuh.fit.account_service.messaging.event;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record StaffShiftReassignedEvent(
        String eventId,
        Long recipientUserId,
        Long assignmentId,
        LocalDate workDate,
        String shiftCode,
        String changeType,
        LocalDateTime occurredAt
) {}
