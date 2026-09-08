package iuh.fit.account_service.config.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET = "educonnect-test-secret-key-that-is-long-enough-123456";

    @Test
    void generatedTokenCarriesServerOwnedUserIdClaim() {
        JwtService service = new JwtService(SECRET, 60_000L);

        String token = service.generateToken(42L, "student@example.com", "STUDENT", List.of("STUDENT"));
        var claims = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseSignedClaims(token)
                .getPayload();

        assertThat(claims.get("userId", Number.class).longValue()).isEqualTo(42L);
        assertThat(claims.getSubject()).isEqualTo("student@example.com");
    }
}
