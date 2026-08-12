package iuh.fit.learningservice.modules.availability.dto;

import iuh.fit.learningservice.modules.availability.entity.AvailabilityStatus;
import jakarta.validation.constraints.NotNull;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

public record AvailabilitySlotRequest(
    UUID id,
    @NotNull DayOfWeek dayOfWeek,
    @NotNull LocalTime startTime,
    @NotNull LocalTime endTime,
    @NotNull AvailabilityStatus status
) {
}
