package iuh.fit.authservice.modules.auth.dto.response;

import iuh.fit.authservice.shared.enums.AccountStatus;
import iuh.fit.authservice.shared.enums.Role;

import java.time.Instant;
import java.util.UUID;

public record AccountResponse(
    UUID id,
    String email,
    Role role,
    AccountStatus status,
    Instant emailVerifiedAt,
    AccountProfileResponse profile,
    Instant createdAt,
    Instant updatedAt
) {
}