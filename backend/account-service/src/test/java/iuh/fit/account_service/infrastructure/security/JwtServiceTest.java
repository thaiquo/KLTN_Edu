package iuh.fit.account_service.infrastructure.security;

import iuh.fit.account_service.infrastructure.config.JwtProperties;
import iuh.fit.account_service.modules.auth.entity.Account;
import iuh.fit.account_service.modules.auth.entity.Session;
import iuh.fit.account_service.shared.enums.AccountStatus;
import iuh.fit.account_service.shared.enums.Role;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    @Test
    void shouldGenerateAndParseAccessToken() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("change-this-secret-change-this-secret-change-this-secret");
        properties.setIssuer("auth-service");
        properties.setAccessTokenTtlMinutes(15);
        properties.setRefreshTokenTtlDays(7);

        JwtService jwtService = new JwtService(properties);

        Account account = new Account();
        account.setId(UUID.randomUUID());
        account.setEmail("student@example.com");
        account.setRole(Role.STUDENT);
        account.setStatus(AccountStatus.ACTIVE);
        account.setTokenVersion(2L);

        String token = jwtService.generateAccessToken(account);

        assertThat(jwtService.isValidAccessToken(token)).isTrue();
        assertThat(jwtService.extractAccountId(token)).isEqualTo(account.getId());
        assertThat(jwtService.extractRole(token)).isEqualTo(Role.STUDENT);
        assertThat(jwtService.extractTokenVersion(token)).isEqualTo(2L);
    }

    @Test
    void shouldGenerateRefreshTokenAndHashItDeterministically() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("change-this-secret-change-this-secret-change-this-secret");
        properties.setIssuer("auth-service");

        JwtService jwtService = new JwtService(properties);

        Account account = new Account();
        account.setId(UUID.randomUUID());
        account.setEmail("student@example.com");
        account.setRole(Role.STUDENT);
        account.setStatus(AccountStatus.ACTIVE);
        account.setTokenVersion(0L);

        Session session = new Session();
        session.setId(UUID.randomUUID());

        String token = jwtService.generateRefreshToken(account, session, UUID.randomUUID());

        assertThat(jwtService.isValidRefreshToken(token)).isTrue();
        assertThat(jwtService.hashToken(token)).isNotBlank();
        assertThat(jwtService.hashToken(token)).isEqualTo(jwtService.hashToken(token));
    }
}