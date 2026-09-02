package iuh.fit.learning_service.config.security;

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
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Component
public class CookieJwtAuthenticationFilter extends OncePerRequestFilter {
    private final SecretKey secretKey;

    public CookieJwtAuthenticationFilter(@Value("${jwt.secret}") String secret) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
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
            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            if (roles != null) {
                for (Object r : roles) {
                    String roleStr = String.valueOf(r);
                    if (!roleStr.startsWith("ROLE_")) roleStr = "ROLE_" + roleStr;
                    authorities.add(new SimpleGrantedAuthority(roleStr));
                }
            }
            if (activeRole != null && !activeRole.isBlank()) {
                String actStr = activeRole.startsWith("ROLE_") ? activeRole : "ROLE_" + activeRole;
                SimpleGrantedAuthority auth = new SimpleGrantedAuthority(actStr);
                if (!authorities.contains(auth)) {
                    authorities.add(auth);
                }
            }
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(email, null, authorities);
            Number userId = claims.get("userId", Number.class);
            if (userId != null) {
                authentication.setDetails(userId.longValue());
            }
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (RuntimeException ex) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        // 1. Check Authorization Header
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }

        // 2. Check Cookies
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("access_token".equals(cookie.getName()) || "token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
