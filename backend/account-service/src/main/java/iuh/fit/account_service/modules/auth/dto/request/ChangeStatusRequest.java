package iuh.fit.account_service.modules.auth.dto.request;

import iuh.fit.account_service.shared.enums.AccountStatus;
import jakarta.validation.constraints.NotNull;

public record ChangeStatusRequest(
    @NotNull(message = "Status is required")
    AccountStatus status,

    String reason
) {
}