package iuh.fit.ai_service.config.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class CookieJwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String ACCESS_TOKEN_COOKIE = "access_token";

    private final JwtService jwtService;

    public CookieJwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = extractTokenFromCookie(request);
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            if (!jwtService.isTokenValid(token)) {
                continueAsGuest(request, response, filterChain);
                return;
            }
            String email = jwtService.extractEmail(token);
            String activeRole = jwtService.extractActiveRole(token);
            List<String> roles = jwtService.extractRoles(token);

            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                List<SimpleGrantedAuthority> authorities = authoritiesForActiveRole(activeRole, roles);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(email, null, authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (RuntimeException exception) {
            continueAsGuest(request, response, filterChain);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private List<SimpleGrantedAuthority> authoritiesForActiveRole(String activeRole, List<String> roles) {
        if (activeRole == null || activeRole.isBlank()) {
            return List.of();
        }
        String normalizedActiveRole = activeRole.trim().toUpperCase();
        boolean declaredInTokenRoles = roles.stream().anyMatch(role -> normalizedActiveRole.equalsIgnoreCase(role));
        if (!declaredInTokenRoles) {
            return List.of();
        }
        return List.of(new SimpleGrantedAuthority("ROLE_" + normalizedActiveRole));
    }

    private void continueAsGuest(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        SecurityContextHolder.clearContext();
        filterChain.doFilter(request, response);
    }

    private String extractTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (ACCESS_TOKEN_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
