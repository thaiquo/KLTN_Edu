package iuh.fit.account_service.modules.auth.dto.response;

import iuh.fit.account_service.shared.enums.Role;

public record AuthResponseBody(
    AccountResponse user,
    Role activeRole,
    String message
) {
}
