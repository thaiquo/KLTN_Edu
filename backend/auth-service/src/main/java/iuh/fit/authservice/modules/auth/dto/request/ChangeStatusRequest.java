package iuh.fit.authservice.modules.auth.dto.request;

import iuh.fit.authservice.shared.enums.AccountStatus;
import jakarta.validation.constraints.NotNull;

public record ChangeStatusRequest(
    @NotNull(message = "Status is required")
    AccountStatus status,

    String reason
) {
}