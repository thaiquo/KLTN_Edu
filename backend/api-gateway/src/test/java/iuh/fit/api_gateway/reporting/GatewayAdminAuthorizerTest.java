package iuh.fit.api_gateway.reporting;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GatewayAdminAuthorizerTest {
    private static final String SECRET = "gateway-admin-health-test-secret-at-least-256-bits";

    @Test
    void activeAdminCanReadDiagnostics() {
        var authorizer = new GatewayAdminAuthorizer(SECRET);
        assertThatCode(() -> authorizer.requireAdmin("access_token=" + token("ADMIN", List.of("ADMIN")), null))
                .doesNotThrowAnyException();
    }

    @Test
    void activeStaffCannotReadAdminDiagnostics() {
        var authorizer = new GatewayAdminAuthorizer(SECRET);
        assertThatThrownBy(() -> authorizer.requireAdmin("access_token=" + token("STAFF", List.of("STAFF")), null))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> org.assertj.core.api.Assertions.assertThat(error.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void activeTutorCanReadOnlyTutorStatistics() {
        var authorizer = new GatewayAdminAuthorizer(SECRET);
        assertThatCode(() -> authorizer.requireTutor(null, "Bearer " + token("TUTOR", List.of("TUTOR"))))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> authorizer.requireAdmin(null, "Bearer " + token("TUTOR", List.of("TUTOR"))))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> org.assertj.core.api.Assertions.assertThat(error.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void assignedTutorRoleDoesNotBypassActiveStudentContext() {
        var authorizer = new GatewayAdminAuthorizer(SECRET);
        assertThatThrownBy(() -> authorizer.requireTutor(
                "access_token=" + token("STUDENT", List.of("STUDENT", "TUTOR")), null))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> org.assertj.core.api.Assertions.assertThat(error.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    private String token(String activeRole, List<String> roles) {
        return Jwts.builder().subject("operator@example.com").claim("activeRole", activeRole)
                .claim("roles", roles).expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }
}
