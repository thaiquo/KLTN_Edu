package iuh.fit.account_service.modules.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.account_service.infrastructure.config.CookieService;
import iuh.fit.account_service.infrastructure.security.AuthPrincipal;
import iuh.fit.account_service.infrastructure.security.JwtService;
import iuh.fit.account_service.infrastructure.security.LoginRateLimitService;
import iuh.fit.account_service.modules.auth.dto.request.ResetPasswordRequest;
import iuh.fit.account_service.modules.auth.entity.Account;
import iuh.fit.account_service.modules.auth.entity.AccountProfile;
import iuh.fit.account_service.modules.auth.entity.LoginHistory;
import iuh.fit.account_service.modules.auth.entity.OutboxEvent;
import iuh.fit.account_service.modules.auth.entity.RefreshToken;
import iuh.fit.account_service.modules.auth.entity.SecurityAudit;
import iuh.fit.account_service.modules.auth.entity.Session;
import iuh.fit.account_service.modules.auth.entity.VerificationToken;
import iuh.fit.account_service.modules.auth.mapper.AccountMapper;
import iuh.fit.account_service.modules.auth.repository.AccountProfileRepository;
import iuh.fit.account_service.modules.auth.repository.AccountRepository;
import iuh.fit.account_service.modules.auth.repository.LoginHistoryRepository;
import iuh.fit.account_service.modules.auth.repository.OutboxEventRepository;
import iuh.fit.account_service.modules.auth.repository.RefreshTokenRepository;
import iuh.fit.account_service.modules.auth.repository.SecurityAuditRepository;
import iuh.fit.account_service.modules.auth.repository.SessionRepository;
import iuh.fit.account_service.modules.auth.repository.VerificationTokenRepository;
import iuh.fit.account_service.modules.role.repository.RoleRepository;
import iuh.fit.account_service.shared.enums.AccountStatus;
import iuh.fit.account_service.shared.enums.AuditAction;
import iuh.fit.account_service.shared.enums.Role;
import iuh.fit.account_service.shared.enums.SessionStatus;
import iuh.fit.account_service.shared.enums.VerificationStatus;
import iuh.fit.account_service.shared.enums.VerificationType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthServiceResetPasswordTest {

    @Mock AccountRepository accountRepository;
    @Mock AccountProfileRepository accountProfileRepository;
    @Mock SessionRepository sessionRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock VerificationTokenRepository verificationTokenRepository;
    @Mock LoginHistoryRepository loginHistoryRepository;
    @Mock SecurityAuditRepository securityAuditRepository;
    @Mock OutboxEventRepository outboxEventRepository;
    @Mock RoleRepository roleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;
    @Mock CookieService cookieService;
    @Mock LoginRateLimitService loginRateLimitService;
    @Mock AccountMapper accountMapper;

    AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
            accountRepository,
            accountProfileRepository,
            sessionRepository,
            refreshTokenRepository,
            verificationTokenRepository,
            loginHistoryRepository,
            securityAuditRepository,
            outboxEventRepository,
            roleRepository,
            passwordEncoder,
            jwtService,
            cookieService,
            loginRateLimitService,
            accountMapper,
            new ObjectMapper()
        );
    }

    @Test
    void resetPassword_shouldUpdatePassword_andRevokeSessionsAndTokens() {
        Account account = new Account();
        account.setId(UUID.randomUUID());
        account.setEmail("student1@example.com");
        account.setPasswordHash("old-hash");
        account.setRole(Role.STUDENT);
        account.setStatus(AccountStatus.ACTIVE);
        account.setTokenVersion(0L);

        Session session = new Session();
        session.setId(UUID.randomUUID());
        session.setAccount(account);
        session.setStatus(SessionStatus.ACTIVE);
        session.setLoginAt(Instant.now());
        session.setLastActivityAt(Instant.now());

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setId(UUID.randomUUID());
        refreshToken.setAccount(account);
        refreshToken.setSession(session);
        refreshToken.setTokenHash("refresh-hash");
        refreshToken.setFamilyId(UUID.randomUUID());
        refreshToken.setExpiredAt(Instant.now().plusSeconds(3600));

        VerificationToken token = new VerificationToken();
        token.setId(UUID.randomUUID());
        token.setAccount(account);
        token.setType(VerificationType.RESET_PASSWORD);
        token.setTokenHash("token-hash");
        token.setExpiredAt(Instant.now().plusSeconds(3600));
        token.setStatus(VerificationStatus.ACTIVE);

        when(jwtService.hashToken("raw-token")).thenReturn("token-hash");
        when(verificationTokenRepository.findByTokenHashAndStatus("token-hash", VerificationStatus.ACTIVE)).thenReturn(Optional.of(token));
        when(passwordEncoder.encode("NewPassword123!")).thenReturn("new-hash");
        when(accountRepository.save(any(Account.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(verificationTokenRepository.save(any(VerificationToken.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessionRepository.findAllByAccount_IdAndStatus(account.getId(), SessionStatus.ACTIVE)).thenReturn(List.of(session));
        when(sessionRepository.save(any(Session.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(refreshTokenRepository.findAllByAccount_Id(account.getId())).thenReturn(List.of(refreshToken));
        when(refreshTokenRepository.findAllBySession_Id(session.getId())).thenReturn(List.of(refreshToken));
        when(securityAuditRepository.save(any(SecurityAudit.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(outboxEventRepository.save(any(OutboxEvent.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = authService.resetPassword(new ResetPasswordRequest("raw-token", "NewPassword123!", "NewPassword123!"));

        assertThat(result.message()).isEqualTo("Password reset successfully");
        assertThat(account.getPasswordHash()).isEqualTo("new-hash");
        assertThat(account.getTokenVersion()).isEqualTo(1L);
        assertThat(token.getStatus()).isEqualTo(VerificationStatus.USED);
        assertThat(token.getUsedAt()).isNotNull();
        assertThat(session.getStatus()).isEqualTo(SessionStatus.REVOKED);
        assertThat(refreshToken.isRevoked()).isTrue();
        assertThat(refreshToken.getRevokedAt()).isNotNull();

        verify(accountRepository).save(account);
        verify(verificationTokenRepository).save(token);
        verify(sessionRepository).save(session);
        verify(securityAuditRepository).save(any(SecurityAudit.class));
        verify(outboxEventRepository).save(any(OutboxEvent.class));
    }
}
