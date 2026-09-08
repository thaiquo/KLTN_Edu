package iuh.fit.contract_service.config.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CookieJwtAuthenticationFilterTest {

    private static final String SECRET = "test-contract-service-jwt-secret-key-256-bit-minimum-value";

    private final CookieJwtAuthenticationFilter filter = new CookieJwtAuthenticationFilter(SECRET);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesPrincipalFromAccessTokenCookieAndIgnoresSpoofedUserHeaders() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/contracts/agreements");
        request.setCookies(new Cookie("access_token", jwt(7L, "student@example.com", "STUDENT", List.of("STUDENT"))));
        request.addHeader("X-User-Id", "999");
        request.addHeader("X-User-Email", "admin@example.com");
        request.addHeader("X-User-Role", "ADMIN");

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(principal).isInstanceOf(ContractUserPrincipal.class);
        ContractUserPrincipal user = (ContractUserPrincipal) principal;
        assertThat(user.userId()).isEqualTo(7L);
        assertThat(user.email()).isEqualTo("student@example.com");
        assertThat(user.activeRole()).isEqualTo("STUDENT");
        assertThat(user.hasRole("ADMIN")).isFalse();
    }

    @Test
    void leavesRequestUnauthenticatedWhenAccessTokenCookieIsMissing() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/contracts/agreements");
        request.addHeader("X-User-Role", "ADMIN");

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private String jwt(Long userId, String email, String activeRole, List<String> roles) {
        return Jwts.builder()
                .subject(email)
                .claim("userId", userId)
                .claim("activeRole", activeRole)
                .claim("roles", roles)
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }
}
