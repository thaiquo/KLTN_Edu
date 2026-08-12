package iuh.fit.learningservice.modules.availability.dto;

import iuh.fit.learningservice.modules.availability.entity.AvailabilityStatus;
import iuh.fit.learningservice.modules.availability.entity.TutorAvailability;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

public record TutorAvailabilityResponse(
    UUID id,
    UUID tutorId,
    DayOfWeek dayOfWeek,
    LocalTime startTime,
    LocalTime endTime,
    AvailabilityStatus status,
    Instant createdAt,
    Instant updatedAt
) {
    public static TutorAvailabilityResponse from(TutorAvailability availability) {
        return new TutorAvailabilityResponse(
            availability.getId(),
            availability.getTutorId(),
            availability.getDayOfWeek(),
            availability.getStartTime(),
            availability.getEndTime(),
            availability.getStatus(),
            availability.getCreatedAt(),
            availability.getUpdatedAt()
        );
    }
}
