package iuh.fit.account_service.controller;

import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.AccountStatus;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import iuh.fit.account_service.exception.UnauthorizedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.crypto.SecretKey;

@RestController
public class InternalNotificationRecipientsController {
    private final UserRoleRepository roles;
    private final SecretKey key;
    public InternalNotificationRecipientsController(UserRoleRepository roles, @Value("${jwt.secret}") String secret) {
        this.roles = roles;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
    public record Recipient(Long recipientId, String targetRole) {}

    @GetMapping("/api/internal/notification-reviewers")
    @Transactional(readOnly = true)
    public List<Recipient> reviewers(@RequestHeader(value = "X-Service-Token", required = false) String token,
                                    @RequestParam(defaultValue = "") String reviewerEmail) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if (!"contract-service".equals(claims.getSubject())
                    || !"notification-recipients".equals(claims.get("serviceScope", String.class))
                    || claims.getExpiration() == null) throw new IllegalArgumentException();
        } catch (Exception e) {
            throw new UnauthorizedException("Service authentication required");
        }
        Map<Long, Recipient> result = new LinkedHashMap<>();
        for (var row : roles.findByRoleIn(List.of(Role.ADMIN, Role.STAFF))) {
            var user = row.getUser();
            if (user.getAccountStatus() != AccountStatus.ACTIVE) continue;
            if (row.getRole() == Role.ADMIN) result.put(user.getId(), new Recipient(user.getId(), "ADMIN"));
            else if (user.getEmail().equalsIgnoreCase(reviewerEmail.trim()))
                result.putIfAbsent(user.getId(), new Recipient(user.getId(), "STAFF"));
        }
        return List.copyOf(result.values());
    }
}
