package iuh.fit.account_service.service;

import iuh.fit.account_service.config.AuthCookieProperties;
import iuh.fit.account_service.dto.auth.RefreshTokenRotation;
import iuh.fit.account_service.entity.RefreshSession;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.exception.UnauthorizedException;
import iuh.fit.account_service.repository.RefreshSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class RefreshTokenService {

    private static final int TOKEN_BYTES = 64;

    private final SecureRandom secureRandom = new SecureRandom();
    private final RefreshSessionRepository refreshSessionRepository;
    private final AuthCookieProperties cookieProperties;

    public RefreshTokenService(
            RefreshSessionRepository refreshSessionRepository,
            AuthCookieProperties cookieProperties
    ) {
        this.refreshSessionRepository = refreshSessionRepository;
        this.cookieProperties = cookieProperties;
    }

    @Transactional
    public String createSession(User user, String activeRole) {
        String rawToken = generateRawToken();
        RefreshSession session = new RefreshSession();
        session.setUser(user);
        session.setTokenHash(hash(rawToken));
        session.setActiveRole(activeRole);
        session.setExpiresAt(LocalDateTime.now().plus(cookieProperties.getRefreshTokenMaxAge()));
        refreshSessionRepository.save(session);
        return rawToken;
    }

    @Transactional
    public RefreshTokenRotation consumeForRefresh(String rawToken) {
        RefreshSession currentSession = findUsableSession(rawToken);
        String activeRole = currentSession.getActiveRole();
        User user = currentSession.getUser();

        currentSession.setRevoked(true);
        currentSession.setRevokedAt(LocalDateTime.now());

        String newRawToken = generateRawToken();
        RefreshSession replacement = new RefreshSession();
        replacement.setUser(user);
        replacement.setTokenHash(hash(newRawToken));
        replacement.setActiveRole(activeRole);
        replacement.setExpiresAt(LocalDateTime.now().plus(cookieProperties.getRefreshTokenMaxAge()));
        refreshSessionRepository.save(replacement);

        currentSession.setReplacedByToken(replacement);
        refreshSessionRepository.save(currentSession);

        return new RefreshTokenRotation(replacement, newRawToken);
    }

    @Transactional
    public void updateActiveRoleIfPresent(String rawToken, String activeRole) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }

        refreshSessionRepository.findByTokenHash(hash(rawToken))
                .filter(session -> !session.isRevoked())
                .filter(session -> !session.getExpiresAt().isBefore(LocalDateTime.now()))
                .ifPresent(session -> {
                    session.setActiveRole(activeRole);
                    refreshSessionRepository.save(session);
                });
    }

    @Transactional
    public void revokeIfPresent(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }

        refreshSessionRepository.findByTokenHash(hash(rawToken)).ifPresent(session -> {
            if (!session.isRevoked()) {
                session.setRevoked(true);
                session.setRevokedAt(LocalDateTime.now());
                refreshSessionRepository.save(session);
            }
        });
    }

    @Transactional
    public void revokeAllForUser(User user) {
        if (user == null || user.getId() == null) {
            return;
        }
        refreshSessionRepository.revokeAllActiveByUserId(user.getId(), LocalDateTime.now());
    }

    private RefreshSession findUsableSession(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new UnauthorizedException("Refresh token is required");
        }

        RefreshSession session = refreshSessionRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new UnauthorizedException("Refresh token is invalid"));

        if (session.isRevoked()) {
            throw new UnauthorizedException("Refresh token has been revoked");
        }

        if (session.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new UnauthorizedException("Refresh token has expired");
        }

        User user = session.getUser();
        if (user == null || !user.isEmailVerified() || user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new UnauthorizedException("Refresh token is invalid");
        }

        return session;
    }

    private String generateRawToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
