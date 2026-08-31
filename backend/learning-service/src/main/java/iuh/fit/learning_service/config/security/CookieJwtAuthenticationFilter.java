package iuh.fit.learning_service.config.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
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
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Component
public class CookieJwtAuthenticationFilter extends OncePerRequestFilter {
    private final SecretKey secretKey;
    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository;

    public CookieJwtAuthenticationFilter(
            @Value("${jwt.secret}") String secret,
            TutorAuthorizationStateRepository tutorAuthorizationStateRepository
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.tutorAuthorizationStateRepository = tutorAuthorizationStateRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Claims claims = Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(token).getPayload();
            if (claims.getExpiration() == null || claims.getExpiration().before(new Date())) {
                filterChain.doFilter(request, response);
                return;
            }
            String email = claims.getSubject();
            List<?> roles = claims.get("roles", List.class);
            String activeRole = claims.get("activeRole", String.class);
            boolean approvedTutorContext = isApprovedTutorContext(claims, activeRole);
            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            if (roles != null) {
                for (Object r : roles) {
                    String roleName = normalizeRoleName(String.valueOf(r));
                    if ("TUTOR".equals(roleName) && !approvedTutorContext) {
                        continue;
                    }
                    String roleStr = "ROLE_" + roleName;
                    authorities.add(new SimpleGrantedAuthority(roleStr));
                }
            }
            if (activeRole != null && !activeRole.isBlank()) {
                String activeRoleName = normalizeRoleName(activeRole);
                if (!"TUTOR".equals(activeRoleName) || approvedTutorContext) {
                    SimpleGrantedAuthority auth = new SimpleGrantedAuthority("ROLE_" + activeRoleName);
                    if (!authorities.contains(auth)) {
                        authorities.add(auth);
                    }
                }
            }
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(email, null, authorities));
        } catch (RuntimeException ex) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("access_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private boolean isApprovedTutorContext(Claims claims, String activeRole) {
        if (!"TUTOR".equals(normalizeRoleName(activeRole))) {
            return false;
        }

        Long userId = extractUserId(claims.get("userId"));
        if (userId == null) {
            return false;
        }

        return tutorAuthorizationStateRepository.findById(userId)
                .map(state -> "APPROVED".equalsIgnoreCase(state.getStatus()))
                .orElseGet(() -> "APPROVED".equalsIgnoreCase(claims.get("tutorStatus", String.class)));
    }

    private Long extractUserId(Object rawUserId) {
        if (rawUserId instanceof Number number) {
            return number.longValue();
        }
        if (rawUserId instanceof String value && !value.isBlank()) {
            try {
                return Long.parseLong(value);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String normalizeRoleName(String role) {
        if (role == null) {
            return "";
        }
        String normalized = role.trim().toUpperCase();
        return normalized.startsWith("ROLE_") ? normalized.substring(5) : normalized;
    }
}
