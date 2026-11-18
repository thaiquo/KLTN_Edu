package iuh.fit.api_gateway.reporting;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;
import java.util.List;

@Component
class GatewayAdminAuthorizer {
    private final SecretKey key;

    GatewayAdminAuthorizer(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    void requireAdmin(String cookie, String authorization) {
        requireActiveRole(cookie, authorization, "ADMIN");
    }

    void requireTutor(String cookie, String authorization) {
        requireActiveRole(cookie, authorization, "TUTOR");
    }

    private void requireActiveRole(String cookie, String authorization, String requiredRole) {
        String token = bearer(authorization);
        if (!StringUtils.hasText(token)) token = cookie(cookie);
        if (!StringUtils.hasText(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            List<?> roles = claims.get("roles", List.class);
            boolean assignedRole = roles != null && roles.stream()
                    .map(String::valueOf).map(this::normalize).anyMatch(requiredRole::equals);
            if (claims.getExpiration() == null || claims.getExpiration().before(new Date())
                    || !requiredRole.equals(normalize(claims.get("activeRole", String.class))) || !assignedRole) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, requiredRole + " permission required");
            }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
    }

    private String bearer(String authorization) {
        return StringUtils.hasText(authorization) && authorization.startsWith("Bearer ")
                ? authorization.substring(7).trim() : null;
    }

    private String cookie(String cookieHeader) {
        if (!StringUtils.hasText(cookieHeader)) return null;
        return Arrays.stream(cookieHeader.split(";"))
                .map(String::trim)
                .filter(value -> value.startsWith("access_token="))
                .map(value -> value.substring("access_token=".length()))
                .filter(StringUtils::hasText)
                .findFirst().orElse(null);
    }

    private String normalize(String role) {
        if (role == null) return "";
        String value = role.trim().toUpperCase();
        return value.startsWith("ROLE_") ? value.substring(5) : value;
    }
}
