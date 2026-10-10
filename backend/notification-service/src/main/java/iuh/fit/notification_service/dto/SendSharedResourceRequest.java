package iuh.fit.notification_service.dto;

import iuh.fit.notification_service.entity.SharedResourceType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SendSharedResourceRequest(
        @NotNull SharedResourceType resourceType,
        @NotNull UUID resourcePublicId,
        @Size(max = 3000) String caption
) {
}
