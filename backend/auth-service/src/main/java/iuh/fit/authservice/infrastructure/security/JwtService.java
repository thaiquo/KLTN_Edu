package iuh.fit.authservice.infrastructure.security;

import iuh.fit.authservice.infrastructure.config.JwtProperties;
import iuh.fit.authservice.modules.auth.entity.Account;
import iuh.fit.authservice.modules.auth.entity.Session;
import iuh.fit.authservice.shared.enums.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class JwtService {

    public static final String TOKEN_TYPE_CLAIM = "token_type";
    public static final String TOKEN_VERSION_CLAIM = "token_version";
    public static final String ROLE_CLAIM = "role";
    public static final String SESSION_ID_CLAIM = "session_id";
    public static final String FAMILY_ID_CLAIM = "family_id";

    private final JwtProperties jwtProperties;
    private final SecretKey secretKey;

    public JwtService(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
        String secret = jwtProperties.getSecret();
        byte[] keyBytes = secret.length() >= 32 && isLikelyBase64(secret)
            ? Decoders.BASE64.decode(secret)
            : secret.getBytes(StandardCharsets.UTF_8);
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(Account account) {
        Instant now = Instant.now();
        return Jwts.builder()
            .issuer(jwtProperties.getIssuer())
            .subject(account.getId().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(jwtProperties.getAccessTokenTtlMinutes(), ChronoUnit.MINUTES)))
            .claim("email", account.getEmail())
            .claim(ROLE_CLAIM, account.getRole().name())
            .claim(TOKEN_VERSION_CLAIM, account.getTokenVersion())
            .claim(TOKEN_TYPE_CLAIM, "access")
            .signWith(secretKey, SignatureAlgorithm.HS256)
            .compact();
    }

    public String generateRefreshToken(Account account, Session session, UUID familyId) {
        Instant now = Instant.now();
        return Jwts.builder()
            .issuer(jwtProperties.getIssuer())
            .id(UUID.randomUUID().toString())
            .subject(account.getId().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(jwtProperties.getRefreshTokenTtlDays(), ChronoUnit.DAYS)))
            .claim(SESSION_ID_CLAIM, session.getId().toString())
            .claim(FAMILY_ID_CLAIM, familyId.toString())
            .claim(TOKEN_VERSION_CLAIM, account.getTokenVersion())
            .claim(TOKEN_TYPE_CLAIM, "refresh")
            .signWith(secretKey, SignatureAlgorithm.HS256)
            .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public boolean isValidAccessToken(String token) {
        Claims claims = parseClaims(token);
        return "access".equals(claims.get(TOKEN_TYPE_CLAIM, String.class));
    }

    public boolean isValidRefreshToken(String token) {
        Claims claims = parseClaims(token);
        return "refresh".equals(claims.get(TOKEN_TYPE_CLAIM, String.class));
    }

    public UUID extractAccountId(String token) {
        return UUID.fromString(parseClaims(token).getSubject());
    }

    public UUID extractSessionId(String token) {
        return UUID.fromString(parseClaims(token).get(SESSION_ID_CLAIM, String.class));
    }

    public UUID extractFamilyId(String token) {
        return UUID.fromString(parseClaims(token).get(FAMILY_ID_CLAIM, String.class));
    }

    public long extractTokenVersion(String token) {
        Number tokenVersion = parseClaims(token).get(TOKEN_VERSION_CLAIM, Number.class);
        return tokenVersion == null ? 0L : tokenVersion.longValue();
    }

    public Role extractRole(String token) {
        String role = parseClaims(token).get(ROLE_CLAIM, String.class);
        return Role.valueOf(role);
    }

    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private boolean isLikelyBase64(String value) {
        try {
            Base64.getDecoder().decode(value);
            return true;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}