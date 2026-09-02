package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class EnrollmentRequestDtos {
    private EnrollmentRequestDtos() {}

    public record EnrollClassRequest(
            @Size(max = 50) String joinKey,
            @Size(max = 1000) String note,
            @Size(max = 255) String studentName,
            @Size(max = 50) String studentPhone
    ) {}

    public record RejectRequestPayload(
            @Size(max = 1000) String reason
    ) {}

    public record EnrollmentRequestResponse(
            Long id,
            Long classRoomId,
            String className,
            String tutorEmail,
            Long studentId,
            String studentEmail,
            String studentName,
            String studentPhone,
            EnrollmentRequestStatus status,
            String joinKey,
            String note,
            String rejectReason,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record BufferPoolStatusResponse(
            Long classRoomId,
            int maxStudents,
            int maxPendingRequests,
            long pendingCount,
            long acceptedCount,
            long totalInPool,
            long availableSlots,
            boolean isFull,
            boolean isBufferPoolFull
    ) {}
}
