package iuh.fit.account_service.modules.auth.dto.response;

import iuh.fit.account_service.shared.enums.AccountStatus;
import iuh.fit.account_service.shared.enums.Role;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record AccountResponse(
    UUID id,
    String email,
    Set<Role> roles,
    AccountStatus status,
    Instant emailVerifiedAt,
    AccountProfileResponse profile,
    Instant createdAt,
    Instant updatedAt
) {
}
