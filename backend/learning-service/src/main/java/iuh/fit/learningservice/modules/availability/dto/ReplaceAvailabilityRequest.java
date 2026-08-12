package iuh.fit.learningservice.modules.availability.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ReplaceAvailabilityRequest(
    @NotNull List<@Valid AvailabilitySlotRequest> availabilities
) {
}
