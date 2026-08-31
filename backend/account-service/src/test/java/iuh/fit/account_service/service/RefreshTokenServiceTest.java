package iuh.fit.account_service.service;

import iuh.fit.account_service.config.AuthCookieProperties;
import iuh.fit.account_service.entity.RefreshSession;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.exception.UnauthorizedException;
import iuh.fit.account_service.repository.RefreshSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RefreshTokenServiceTest {

    private final RefreshSessionRepository refreshSessionRepository = mock(RefreshSessionRepository.class);
    private RefreshTokenService refreshTokenService;
    private User user;

    @BeforeEach
    void setUp() {
        AuthCookieProperties properties = new AuthCookieProperties();
        properties.setRefreshTokenMaxAge(Duration.ofDays(7));
        refreshTokenService = new RefreshTokenService(refreshSessionRepository, properties);

        user = new User();
        ReflectionTestUtils.setField(user, "id", 9L);
        user.setEmail("test@example.com");
        user.setFullName("Test User");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);
    }

    @Test
    void createSessionReturnsRawTokenAndStoresOnlyHash() {
        String rawToken = refreshTokenService.createSession(user, "STUDENT");

        var captor = org.mockito.ArgumentCaptor.forClass(RefreshSession.class);
        verify(refreshSessionRepository).save(captor.capture());

        RefreshSession saved = captor.getValue();
        assertThat(rawToken).isNotBlank();
        assertThat(saved.getTokenHash()).hasSize(64);
        assertThat(saved.getTokenHash()).isNotEqualTo(rawToken);
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getActiveRole()).isEqualTo("STUDENT");
        assertThat(saved.isRevoked()).isFalse();
    }

    @Test
    void consumeForRefreshRevokesOldSessionAndCreatesReplacement() {
        RefreshSession current = activeSession("STUDENT");
        when(refreshSessionRepository.findByTokenHash(anyString())).thenReturn(Optional.of(current));

        var rotation = refreshTokenService.consumeForRefresh("raw-refresh-token");

        assertThat(current.isRevoked()).isTrue();
        assertThat(current.getRevokedAt()).isNotNull();
        assertThat(current.getReplacedByToken()).isNotNull();
        assertThat(rotation.getRawRefreshToken()).isNotBlank();
        assertThat(rotation.getRefreshSession().getTokenHash()).hasSize(64);
        assertThat(rotation.getRefreshSession().getTokenHash()).isNotEqualTo(rotation.getRawRefreshToken());
        assertThat(rotation.getRefreshSession().getActiveRole()).isEqualTo("STUDENT");
    }

    @Test
    void revokedRefreshTokenIsRejected() {
        RefreshSession current = activeSession("STUDENT");
        current.setRevoked(true);
        when(refreshSessionRepository.findByTokenHash(anyString())).thenReturn(Optional.of(current));

        assertThatThrownBy(() -> refreshTokenService.consumeForRefresh("raw-refresh-token"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token has been revoked");
    }

    @Test
    void expiredRefreshTokenIsRejected() {
        RefreshSession current = activeSession("STUDENT");
        current.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        when(refreshSessionRepository.findByTokenHash(anyString())).thenReturn(Optional.of(current));

        assertThatThrownBy(() -> refreshTokenService.consumeForRefresh("raw-refresh-token"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token has expired");
    }

    @Test
    void missingRefreshTokenIsRejected() {
        assertThatThrownBy(() -> refreshTokenService.consumeForRefresh(null))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token is required");
    }

    private RefreshSession activeSession(String activeRole) {
        RefreshSession session = new RefreshSession();
        session.setUser(user);
        session.setTokenHash("a".repeat(64));
        session.setActiveRole(activeRole);
        session.setExpiresAt(LocalDateTime.now().plusDays(1));
        return session;
    }
}
