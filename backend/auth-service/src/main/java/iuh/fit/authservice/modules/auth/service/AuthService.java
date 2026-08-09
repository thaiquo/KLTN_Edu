package iuh.fit.authservice.modules.auth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.authservice.infrastructure.config.CookieService;
import iuh.fit.authservice.infrastructure.security.AuthPrincipal;
import iuh.fit.authservice.infrastructure.security.LoginRateLimitService;
import iuh.fit.authservice.infrastructure.security.JwtService;
import iuh.fit.authservice.modules.auth.dto.request.ChangePasswordRequest;
import iuh.fit.authservice.modules.auth.dto.request.ForgotPasswordRequest;
import iuh.fit.authservice.modules.auth.dto.request.LoginRequest;
import iuh.fit.authservice.modules.auth.dto.request.RegisterRequest;
import iuh.fit.authservice.modules.auth.dto.request.ResetPasswordRequest;
import iuh.fit.authservice.modules.auth.dto.request.UpdateProfileRequest;
import iuh.fit.authservice.modules.auth.dto.request.ChangeStatusRequest;
import iuh.fit.authservice.modules.auth.dto.response.AccountResponse;
import iuh.fit.authservice.modules.auth.dto.response.AuthResponseBody;
import iuh.fit.authservice.modules.auth.dto.response.MessageResponse;
import iuh.fit.authservice.modules.auth.dto.response.SessionResponse;
import iuh.fit.authservice.modules.auth.entity.Account;
import iuh.fit.authservice.modules.auth.entity.AccountProfile;
import iuh.fit.authservice.modules.auth.entity.LoginHistory;
import iuh.fit.authservice.modules.auth.entity.OutboxEvent;
import iuh.fit.authservice.modules.auth.entity.RefreshToken;
import iuh.fit.authservice.modules.auth.entity.SecurityAudit;
import iuh.fit.authservice.modules.auth.entity.Session;
import iuh.fit.authservice.modules.auth.entity.VerificationToken;
import iuh.fit.authservice.modules.auth.mapper.AccountMapper;
import iuh.fit.authservice.modules.auth.repository.AccountProfileRepository;
import iuh.fit.authservice.modules.auth.repository.AccountRepository;
import iuh.fit.authservice.modules.auth.repository.LoginHistoryRepository;
import iuh.fit.authservice.modules.auth.repository.OutboxEventRepository;
import iuh.fit.authservice.modules.auth.repository.RefreshTokenRepository;
import iuh.fit.authservice.modules.auth.repository.SecurityAuditRepository;
import iuh.fit.authservice.modules.auth.repository.SessionRepository;
import iuh.fit.authservice.modules.auth.repository.VerificationTokenRepository;
import iuh.fit.authservice.shared.enums.AccountStatus;
import iuh.fit.authservice.shared.enums.AuditAction;
import iuh.fit.authservice.shared.enums.OutboxStatus;
import iuh.fit.authservice.shared.enums.Role;
import iuh.fit.authservice.shared.enums.SessionStatus;
import iuh.fit.authservice.shared.enums.VerificationStatus;
import iuh.fit.authservice.shared.enums.VerificationType;
import iuh.fit.authservice.shared.exception.ConflictException;
import iuh.fit.authservice.shared.exception.ForbiddenException;
import iuh.fit.authservice.shared.exception.NotFoundException;
import iuh.fit.authservice.shared.exception.UnauthorizedException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class AuthService {

    private final AccountRepository accountRepository;
    private final AccountProfileRepository accountProfileRepository;
    private final SessionRepository sessionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final VerificationTokenRepository verificationTokenRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final SecurityAuditRepository securityAuditRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CookieService cookieService;
    private final LoginRateLimitService loginRateLimitService;
    private final AccountMapper accountMapper;
    private final ObjectMapper objectMapper;

    public AuthService(AccountRepository accountRepository,
                       AccountProfileRepository accountProfileRepository,
                       SessionRepository sessionRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       VerificationTokenRepository verificationTokenRepository,
                       LoginHistoryRepository loginHistoryRepository,
                       SecurityAuditRepository securityAuditRepository,
                       OutboxEventRepository outboxEventRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       CookieService cookieService,
                       LoginRateLimitService loginRateLimitService,
                       AccountMapper accountMapper,
                       ObjectMapper objectMapper) {
        this.accountRepository = accountRepository;
        this.accountProfileRepository = accountProfileRepository;
        this.sessionRepository = sessionRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.verificationTokenRepository = verificationTokenRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.securityAuditRepository = securityAuditRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.cookieService = cookieService;
        this.loginRateLimitService = loginRateLimitService;
        this.accountMapper = accountMapper;
        this.objectMapper = objectMapper;
    }

    public AuthResponseBody register(RegisterRequest request) {
        validatePasswordConfirmation(request.password(), request.confirmPassword());
        ensureEmailAvailable(request.email());

        Account account = new Account();
        account.setEmail(request.email());
        account.setPasswordHash(passwordEncoder.encode(request.password()));
        account.setRole(Role.STUDENT);
        account.setStatus(AccountStatus.PENDING_VERIFICATION);
        account = accountRepository.save(account);

        AccountProfile profile = new AccountProfile();
        profile.setAccount(account);
        profile.setFullName(request.fullName());
        profile.setPhone(request.phone());
        accountProfileRepository.save(profile);
        account.setProfile(profile);

        String verificationToken = issueVerificationToken(account, VerificationType.VERIFY_EMAIL);
        saveAudit(account, AuditAction.REGISTERED, "Account registered");
        saveOutbox(account.getId(), "Account", "AccountRegistered", Map.of(
            "accountId", account.getId(),
            "email", account.getEmail(),
            "fullName", profile.getFullName(),
            "verificationToken", verificationToken
        ));

        return new AuthResponseBody(accountMapper.toAccountResponse(account), "Registered successfully. Please verify your email.");
    }

    public AuthResponseBody login(LoginRequest request, HttpServletResponse response, String ipAddress, String userAgent) {
        loginRateLimitService.ensureAllowed(request.email(), ipAddress);
        Account account = accountRepository.findByEmailIgnoreCase(request.email()).orElse(null);

        if (account == null) {
            recordLoginAttempt(request.email(), false, ipAddress, userAgent, "Account not found", null);
            loginRateLimitService.registerFailure(request.email(), ipAddress);
            throw new UnauthorizedException("Email or password is incorrect");
        }

        boolean passwordMatched = passwordEncoder.matches(request.password(), account.getPasswordHash());
        boolean accountActive = account.getStatus() == AccountStatus.ACTIVE || account.getStatus() == AccountStatus.PENDING_VERIFICATION;
        if (!passwordMatched || !accountActive) {
            recordLoginAttempt(request.email(), false, ipAddress, userAgent, "Invalid credentials or inactive account", account);
            loginRateLimitService.registerFailure(request.email(), ipAddress);
            throw new UnauthorizedException("Email or password is incorrect");
        }

        Session session = createSession(account, ipAddress, userAgent);
        String accessToken = jwtService.generateAccessToken(account);
        String refreshToken = jwtService.generateRefreshToken(account, session, UUID.randomUUID());
        saveRefreshToken(account, session, refreshToken);

        account.setLastLoginAt(Instant.now());
        account.setFailedLoginCount(0);
        accountRepository.save(account);
        recordLoginAttempt(request.email(), true, ipAddress, userAgent, null, account);
        loginRateLimitService.reset(request.email(), ipAddress);
        saveAudit(account, AuditAction.SESSION_CREATED, "Session created");
        saveOutbox(account.getId(), "Session", "SessionCreated", Map.of(
            "accountId", account.getId(),
            "sessionId", session.getId(),
            "loginAt", session.getLoginAt()
        ));

        setAuthCookies(response, accessToken, refreshToken);

        return new AuthResponseBody(accountMapper.toAccountResponse(account), "Login successful");
    }

    public AuthResponseBody refresh(String refreshTokenValue, HttpServletResponse response) {
        if (!StringUtils.hasText(refreshTokenValue)) {
            throw new UnauthorizedException("Refresh token is required");
        }

        String tokenHash = jwtService.hashToken(refreshTokenValue);
        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (storedToken.isRevoked() || storedToken.getExpiredAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Refresh token has expired or been revoked");
        }

        Account account = storedToken.getAccount();
        if (account.getStatus() != AccountStatus.ACTIVE && account.getStatus() != AccountStatus.PENDING_VERIFICATION) {
            throw new ForbiddenException("Account is not active");
        }

        Session session = storedToken.getSession();
        String newAccessToken = jwtService.generateAccessToken(account);
        String newRefreshToken = jwtService.generateRefreshToken(account, session, storedToken.getFamilyId());

        storedToken.setRevoked(true);
        storedToken.setRevokedAt(Instant.now());
        refreshTokenRepository.save(storedToken);
        saveRefreshToken(account, session, newRefreshToken, storedToken.getFamilyId());
        session.setLastActivityAt(Instant.now());
        sessionRepository.save(session);
        saveAudit(account, AuditAction.REFRESH_ROTATED, "Refresh token rotated");
        saveOutbox(account.getId(), "Session", "RefreshTokenRotated", Map.of(
            "accountId", account.getId(),
            "sessionId", session.getId(),
            "familyId", storedToken.getFamilyId()
        ));

        account.setProfile(resolveProfile(account));

        setAuthCookies(response, newAccessToken, newRefreshToken);
        return new AuthResponseBody(accountMapper.toAccountResponse(account), "Token refreshed successfully");
    }

    public MessageResponse logout(String refreshTokenValue, HttpServletResponse response) {
        if (StringUtils.hasText(refreshTokenValue)) {
            refreshTokenRepository.findByTokenHash(jwtService.hashToken(refreshTokenValue))
                .ifPresent(token -> {
                    token.setRevoked(true);
                    token.setRevokedAt(Instant.now());
                    refreshTokenRepository.save(token);
                    revokeSession(token.getSession());
                    saveAudit(token.getAccount(), AuditAction.LOGOUT, "Logout completed");
                });
        }

        clearAuthCookies(response);
        return new MessageResponse("Logout successful");
    }

    public MessageResponse logoutAll(AuthPrincipal principal, HttpServletResponse response) {
        Account account = loadActiveAccount(principal.id());
        List<Session> sessions = sessionRepository.findAllByAccount_IdAndStatus(account.getId(), SessionStatus.ACTIVE);
        sessions.forEach(this::revokeSession);
        refreshTokenRepository.findAllByAccount_Id(account.getId()).forEach(token -> {
            token.setRevoked(true);
            token.setRevokedAt(Instant.now());
        });
        saveAudit(account, AuditAction.LOGOUT_ALL, "Logout all devices");
        saveOutbox(account.getId(), "Session", "LogoutAllCompleted", Map.of("accountId", account.getId()));
        clearAuthCookies(response);
        return new MessageResponse("Logout all successful");
    }

    public MessageResponse forgotPassword(ForgotPasswordRequest request) {
        accountRepository.findByEmailIgnoreCase(request.email())
            .ifPresent(account -> {
                issueVerificationToken(account, VerificationType.RESET_PASSWORD);
                saveOutbox(account.getId(), "Verification", "PasswordResetRequested", Map.of(
                    "accountId", account.getId(),
                    "email", account.getEmail()
                ));
            });
        return new MessageResponse("If the email exists, a reset link has been sent");
    }

    public MessageResponse resetPassword(ResetPasswordRequest request) {
        validatePasswordConfirmation(request.newPassword(), request.confirmPassword());
        VerificationToken token = verificationTokenRepository.findByTokenHashAndStatus(jwtService.hashToken(request.token()), VerificationStatus.ACTIVE)
            .orElseThrow(() -> new UnauthorizedException("Reset token is invalid or expired"));
        if (token.getType() != VerificationType.RESET_PASSWORD || token.getExpiredAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Reset token is invalid or expired");
        }

        Account account = token.getAccount();
        account.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);

        token.setStatus(VerificationStatus.USED);
        token.setUsedAt(Instant.now());
        verificationTokenRepository.save(token);

        revokeAllSessionsAndTokens(account);
        saveAudit(account, AuditAction.PASSWORD_CHANGED, "Password reset completed");
        saveOutbox(account.getId(), "Account", "PasswordChanged", Map.of("accountId", account.getId()));
        return new MessageResponse("Password reset successfully");
    }

    public MessageResponse verifyEmail(String tokenValue) {
        VerificationToken token = verificationTokenRepository.findByTokenHashAndStatus(jwtService.hashToken(tokenValue), VerificationStatus.ACTIVE)
            .orElseThrow(() -> new UnauthorizedException("Verification token is invalid or expired"));
        if (token.getType() != VerificationType.VERIFY_EMAIL || token.getExpiredAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Verification token is invalid or expired");
        }

        Account account = token.getAccount();
        account.setEmailVerifiedAt(Instant.now());
        if (account.getStatus() == AccountStatus.PENDING_VERIFICATION) {
            account.setStatus(AccountStatus.ACTIVE);
        }
        accountRepository.save(account);

        token.setStatus(VerificationStatus.USED);
        token.setUsedAt(Instant.now());
        verificationTokenRepository.save(token);

        saveAudit(account, AuditAction.EMAIL_VERIFIED, "Email verified");
        saveOutbox(account.getId(), "Account", "EmailVerified", Map.of("accountId", account.getId(), "email", account.getEmail()));
        return new MessageResponse("Email verified successfully");
    }

    public AccountResponse getCurrentAccount(AuthPrincipal principal) {
        Account account = loadActiveAccount(principal.id());
        account.setProfile(resolveProfile(account));
        return accountMapper.toAccountResponse(account);
    }

    public AccountResponse updateProfile(AuthPrincipal principal, UpdateProfileRequest request) {
        Account account = loadActiveAccount(principal.id());
        AccountProfile profile = accountProfileRepository.findByAccountId(account.getId())
            .orElseThrow(() -> new NotFoundException("Profile not found"));
        profile.setFullName(request.fullName());
        profile.setPhone(request.phone());
        profile.setAvatarUrl(request.avatarUrl());
        accountProfileRepository.save(profile);
        account.setProfile(profile);
        saveAudit(account, AuditAction.PROFILE_UPDATED, "Profile updated");
        saveOutbox(account.getId(), "Account", "ProfileUpdated", Map.of(
            "accountId", account.getId(),
            "fullName", profile.getFullName(),
            "phone", profile.getPhone(),
            "avatarUrl", profile.getAvatarUrl()
        ));
        return accountMapper.toAccountResponse(account);
    }

    public MessageResponse changePassword(AuthPrincipal principal, ChangePasswordRequest request) {
        validatePasswordConfirmation(request.newPassword(), request.confirmPassword());
        Account account = loadActiveAccount(principal.id());
        if (!passwordEncoder.matches(request.currentPassword(), account.getPasswordHash())) {
            throw new UnauthorizedException("Current password is incorrect");
        }
        account.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);
        revokeAllSessionsAndTokens(account);
        saveAudit(account, AuditAction.PASSWORD_CHANGED, "Password changed");
        saveOutbox(account.getId(), "Account", "PasswordChanged", Map.of("accountId", account.getId()));
        return new MessageResponse("Password changed successfully");
    }

    public Page<SessionResponse> listSessions(AuthPrincipal principal, Pageable pageable) {
        return sessionRepository.findAllByAccount_IdOrderByLastActivityAtDesc(principal.id(), pageable)
            .map(accountMapper::toSessionResponse);
    }

    public MessageResponse revokeSession(AuthPrincipal principal, UUID sessionId) {
        Session session = sessionRepository.findByIdAndAccount_Id(sessionId, principal.id())
            .orElseThrow(() -> new NotFoundException("Session not found"));
        revokeSession(session);
        saveAudit(loadActiveAccount(principal.id()), AuditAction.SESSION_REVOKED, "Session revoked");
        saveOutbox(principal.id(), "Session", "SessionRevoked", Map.of("accountId", principal.id(), "sessionId", sessionId));
        return new MessageResponse("Session revoked successfully");
    }

    public Page<AccountResponse> adminListAccounts(Pageable pageable) {
        return accountRepository.findAllByOrderByCreatedAtDesc(pageable).map(accountMapper::toAccountResponse);
    }

    public AccountResponse adminChangeStatus(UUID accountId, ChangeStatusRequest request) {
        Account account = accountRepository.findById(accountId)
            .orElseThrow(() -> new NotFoundException("Account not found"));
        account.setStatus(request.status());
        if (request.status() == AccountStatus.LOCKED) {
            account.setLockedUntil(Instant.now().plusSeconds(900));
            saveAudit(account, AuditAction.ACCOUNT_LOCKED, request.reason());
        } else if (request.status() == AccountStatus.ACTIVE) {
            account.setLockedUntil(null);
            saveAudit(account, AuditAction.ACCOUNT_UNLOCKED, request.reason());
        } else {
            saveAudit(account, AuditAction.STATUS_CHANGED, request.reason());
        }
        accountRepository.save(account);
        if (request.status() != AccountStatus.ACTIVE) {
            revokeAllSessionsAndTokens(account);
        }
        saveOutbox(account.getId(), "Account", "AccountStatusChanged", Map.of(
            "accountId", account.getId(),
            "status", request.status().name(),
            "reason", request.reason()
        ));
        account.setProfile(resolveProfile(account));
        return accountMapper.toAccountResponse(account);
    }

    public String getCsrfToken(org.springframework.security.web.csrf.CsrfToken token) {
        return token.getToken();
    }

    private Account loadActiveAccount(UUID accountId) {
        Account account = accountRepository.findById(accountId)
            .orElseThrow(() -> new NotFoundException("Account not found"));
        if (account.getStatus() == AccountStatus.DELETED) {
            throw new NotFoundException("Account not found");
        }
        return account;
    }

    private Session createSession(Account account, String ipAddress, String userAgent) {
        Session session = new Session();
        session.setAccount(account);
        session.setIpAddress(ipAddress);
        session.setBrowser(userAgent);
        session.setLoginAt(Instant.now());
        session.setLastActivityAt(Instant.now());
        return sessionRepository.save(session);
    }

    private void saveRefreshToken(Account account, Session session, String refreshToken) {
        saveRefreshToken(account, session, refreshToken, UUID.randomUUID());
    }

    private void saveRefreshToken(Account account, Session session, String refreshToken, UUID familyId) {
        RefreshToken token = new RefreshToken();
        token.setAccount(account);
        token.setSession(session);
        token.setFamilyId(familyId);
        token.setTokenHash(jwtService.hashToken(refreshToken));
        token.setExpiredAt(Instant.now().plusSeconds(60L * 60L * 24L * 7L));
        refreshTokenRepository.save(token);
    }

    private String issueVerificationToken(Account account, VerificationType type) {
        String rawToken = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        VerificationToken token = new VerificationToken();
        token.setAccount(account);
        token.setType(type);
        token.setTokenHash(jwtService.hashToken(rawToken));
        token.setExpiredAt(Instant.now().plusSeconds(60L * 60L * 24L));
        token.setStatus(VerificationStatus.ACTIVE);
        verificationTokenRepository.save(token);
        return rawToken;
    }

    private void recordLoginAttempt(String email, boolean success, String ipAddress, String userAgent, String failureReason, Account account) {
        LoginHistory history = new LoginHistory();
        history.setAttemptedEmail(email.toLowerCase(Locale.ROOT));
        history.setSuccess(success);
        history.setFailureReason(failureReason);
        history.setIpAddress(ipAddress);
        history.setUserAgent(userAgent);
        history.setAccount(account);
        loginHistoryRepository.save(history);
    }

    private void revokeSession(Session session) {
        session.setStatus(SessionStatus.REVOKED);
        session.setRevokedAt(Instant.now());
        session.setLastActivityAt(Instant.now());
        sessionRepository.save(session);
        refreshTokenRepository.findAllBySession_Id(session.getId()).forEach(token -> {
            token.setRevoked(true);
            token.setRevokedAt(Instant.now());
        });
    }

    private void revokeAllSessionsAndTokens(Account account) {
        sessionRepository.findAllByAccount_IdAndStatus(account.getId(), SessionStatus.ACTIVE).forEach(this::revokeSession);
        refreshTokenRepository.findAllByAccount_Id(account.getId()).forEach(token -> {
            token.setRevoked(true);
            token.setRevokedAt(Instant.now());
        });
    }

    private void ensureEmailAvailable(String email) {
        if (accountRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("Email already exists");
        }
    }

    private void validatePasswordConfirmation(String password, String confirmPassword) {
        if (!password.equals(confirmPassword)) {
            throw new ConflictException("Password confirmation does not match");
        }
    }

    private void saveAudit(Account account, AuditAction action, String detail) {
        SecurityAudit audit = new SecurityAudit();
        audit.setAccount(account);
        audit.setAction(action);
        audit.setDetail(detail);
        securityAuditRepository.save(audit);
    }

    private void saveOutbox(UUID aggregateId, String aggregateType, String eventType, Map<String, Object> payload) {
        OutboxEvent event = new OutboxEvent();
        event.setAggregateId(aggregateId);
        event.setAggregateType(aggregateType);
        event.setEventType(eventType);
        event.setStatus(OutboxStatus.PENDING);
        try {
            event.setPayload(objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize outbox payload", exception);
        }
        outboxEventRepository.save(event);
    }

    private AccountProfile resolveProfile(Account account) {
        return accountProfileRepository.findByAccountId(account.getId()).orElse(null);
    }

    private void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        if (StringUtils.hasText(accessToken)) {
            response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookieService.createAccessTokenCookie(accessToken).toString());
        }
        if (StringUtils.hasText(refreshToken)) {
            response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookieService.createRefreshTokenCookie(refreshToken).toString());
        }
    }

    private void clearAuthCookies(HttpServletResponse response) {
        response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookieService.clearAccessTokenCookie().toString());
        response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookieService.clearRefreshTokenCookie().toString());
        response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookieService.clearCsrfCookie().toString());
    }
}