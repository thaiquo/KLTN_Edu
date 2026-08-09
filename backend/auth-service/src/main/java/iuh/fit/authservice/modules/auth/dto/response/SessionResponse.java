package iuh.fit.authservice.modules.auth.dto.response;

import iuh.fit.authservice.shared.enums.SessionStatus;

import java.time.Instant;
import java.util.UUID;

public record SessionResponse(
    UUID id,
    String deviceName,
    String browser,
    String os,
    String ipAddress,
    Instant loginAt,
    Instant lastActivityAt,
    SessionStatus status
) {
}