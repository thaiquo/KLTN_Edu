package iuh.fit.account_service.config.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

@Service
public class JwtService {

    private final SecretKey secretKey;
    private final long expiration;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long expiration
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
    }

    public String generateToken(String email, List<String> roles) {
        return generateToken(email, roles.isEmpty() ? null : roles.get(0), roles);
    }

    public String generateToken(String email, String activeRole, List<String> roles) {
        return generateToken(email, null, activeRole, roles, null);
    }

    public String generateToken(String email, Long userId, String activeRole, List<String> roles, String tutorStatus) {
        Date now = new Date();
        Date expirationDate = new Date(now.getTime() + expiration);

        var builder = Jwts.builder()
                .subject(email)
                .claim("activeRole", activeRole)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expirationDate);

        if (userId != null) {
            builder.claim("userId", userId);
        }
        if (tutorStatus != null && !tutorStatus.isBlank()) {
            builder.claim("tutorStatus", tutorStatus);
        }

        return builder.signWith(secretKey).compact();
    }

    public String extractEmail(String token) {
        return getClaims(token).getSubject();
    }

    public String extractActiveRole(String token) {
        try {
            Claims claims = getClaims(token);
            return claims.get("activeRole", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    public boolean isTokenValid(String token) {
        try {
            Claims claims = getClaims(token);
            return claims.getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    public long getExpirationMillis() {
        return expiration;
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
