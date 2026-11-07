package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.roster.StaffDutyDtos.WriteAccess;
import iuh.fit.account_service.exception.UnauthorizedException;
import iuh.fit.account_service.service.StaffDutyRosterService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Set;

@RestController
public class InternalStaffDutyController {
    private static final Set<String> ALLOWED_SUBJECTS =
            Set.of("learning-service", "contract-service");

    private final StaffDutyRosterService service;
    private final SecretKey key;

    public InternalStaffDutyController(
            StaffDutyRosterService service,
            @Value("${jwt.secret}") String secret
    ) {
        this.service = service;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/api/internal/staff-duty/write-access")
    public WriteAccess writeAccess(
            @RequestHeader(value = "X-Service-Token", required = false) String token,
            @RequestParam String staffEmail
    ) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if (!ALLOWED_SUBJECTS.contains(claims.getSubject())
                    || !"staff-duty-check".equals(claims.get("serviceScope", String.class))
                    || claims.getExpiration() == null) {
                throw new IllegalArgumentException();
            }
        } catch (Exception exception) {
            throw new UnauthorizedException("Service authentication required");
        }
        return service.writeAccess(staffEmail);
    }
}
