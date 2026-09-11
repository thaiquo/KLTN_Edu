package iuh.fit.contract_service.config.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

@Component
public class CookieJwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String ACCESS_TOKEN_COOKIE = "access_token";

    private final SecretKey secretKey;

    public CookieJwtAuthenticationFilter(@Value("${jwt.secret}") String secret) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        if (request.getRequestURI().startsWith("/api/contracts/internal/")) {
            try {
                Claims claims = Jwts.parser().verifyWith(secretKey).build()
                        .parseSignedClaims(request.getHeader("X-Service-Token")).getPayload();
                if (!"learning-service".equals(claims.getSubject())
                        || !"contract-settlement".equals(claims.get("serviceScope", String.class))
                        || claims.getExpiration() == null) {
                    throw new IllegalArgumentException("Invalid service identity");
                }
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken("learning-service", null,
                                List.of(new SimpleGrantedAuthority("ROLE_INTERNAL_LEARNING"))));
            } catch (Exception ex) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
            filterChain.doFilter(request, response);
            return;
        }

        String token = extractAccessToken(request);
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Claims claims = Jwts.parser()
                        .verifyWith(secretKey)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                Long userId = readUserId(claims.get("userId"));
                String email = claims.getSubject();
                String activeRole = claims.get("activeRole", String.class);
                List<String> roles = readRoles(claims.get("roles"));

                if (userId != null && email != null && !email.isBlank()) {
                    ContractUserPrincipal principal = new ContractUserPrincipal(userId, email, activeRole, roles);
                    var authorities = principal.roles().stream()
                            .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                            .toList();
                    var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception ignored) {
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractAccessToken(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (ACCESS_TOKEN_COOKIE.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private Long readUserId(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private List<String> readRoles(Object value) {
        if (value instanceof List<?> list) {
            return list.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .map(this::normalizeRole)
                    .filter(role -> !role.isBlank())
                    .distinct()
                    .toList();
        }
        if (value instanceof String text && !text.isBlank()) {
            return List.of(normalizeRole(text));
        }
        return List.of();
    }

    private String normalizeRole(String role) {
        return role == null
                ? ""
                : role.replace("ROLE_", "").trim().toUpperCase(Locale.ROOT);
    }
}
