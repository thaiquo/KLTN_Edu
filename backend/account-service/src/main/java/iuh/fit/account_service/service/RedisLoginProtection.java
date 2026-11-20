package iuh.fit.account_service.service;

import iuh.fit.account_service.config.LoginProtectionProperties;
import iuh.fit.account_service.exception.LoginProtectionException;
import org.springframework.dao.DataAccessException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;

import java.util.function.Supplier;

@Service
public class RedisLoginProtection implements LoginProtection {
    private final LoginAttemptStore attemptStore;
    private final TurnstileVerifier turnstileVerifier;
    private final LoginProtectionProperties properties;

    public RedisLoginProtection(LoginAttemptStore attemptStore,
                                TurnstileVerifier turnstileVerifier,
                                LoginProtectionProperties properties) {
        this.attemptStore = attemptStore;
        this.turnstileVerifier = turnstileVerifier;
        this.properties = properties;
    }

    @Override
    public <T> T execute(String normalizedEmail, String turnstileToken, String remoteIp,
                         Supplier<T> authentication) {
        return execute(normalizedEmail, turnstileToken, remoteIp, authentication, false);
    }

    @Override
    public <T> T executeMobile(String normalizedEmail, String remoteIp, Supplier<T> authentication) {
        return execute(normalizedEmail, null, remoteIp, authentication, true);
    }

    private <T> T execute(String normalizedEmail, String turnstileToken, String remoteIp,
                          Supplier<T> authentication, boolean mobile) {
        if (!properties.isEnabled()) return authentication.get();

        String leaseToken;
        try {
            leaseToken = attemptStore.tryAcquire(normalizedEmail, properties.getLockDuration());
        } catch (RuntimeException exception) {
            throw unavailable(exception);
        }
        if (leaseToken == null) {
            throw LoginProtectionException.attemptInProgress(
                    Math.max(1, properties.getLockDuration().toSeconds()));
        }

        try {
            enforceChallengeWhenRequired(normalizedEmail, turnstileToken, remoteIp, mobile);
            try {
                T result = authentication.get();
                attemptStore.clearFailures(normalizedEmail);
                return result;
            } catch (BadCredentialsException exception) {
                int failures = attemptStore.recordFailure(normalizedEmail, properties.getFailureWindow());
                if (failures >= properties.getFailureThreshold()) {
                    throw mobile ? mobileRetryLater(normalizedEmail)
                            : LoginProtectionException.challengeRequired();
                }
                throw exception;
            }
        } catch (LoginProtectionException exception) {
            throw exception;
        } catch (DataAccessException | IllegalStateException exception) {
            throw unavailable(exception);
        } finally {
            try {
                attemptStore.release(normalizedEmail, leaseToken);
            } catch (RuntimeException ignored) {
                // The lease has a bounded TTL. Never hide the authentication result on cleanup failure.
            }
        }
    }

    private void enforceChallengeWhenRequired(String normalizedEmail, String token, String remoteIp, boolean mobile) {
        int failures = attemptStore.failureCount(normalizedEmail);
        if (failures < properties.getFailureThreshold()) return;
        if (mobile) throw mobileRetryLater(normalizedEmail);
        if (token == null || token.isBlank()) throw LoginProtectionException.challengeRequired();

        TurnstileVerifier.VerificationResult result = turnstileVerifier.verify(token, remoteIp);
        if (result == TurnstileVerifier.VerificationResult.INVALID) {
            throw LoginProtectionException.challengeRequired();
        }
        if (result == TurnstileVerifier.VerificationResult.UNAVAILABLE) {
            throw LoginProtectionException.unavailable();
        }
    }

    private LoginProtectionException mobileRetryLater(String normalizedEmail) {
        long remaining = attemptStore.remainingFailureWindowSeconds(normalizedEmail);
        return LoginProtectionException.mobileRetryLater(remaining > 0
                ? remaining : properties.getFailureWindow().toSeconds());
    }

    private LoginProtectionException unavailable(RuntimeException cause) {
        LoginProtectionException exception = LoginProtectionException.unavailable();
        exception.initCause(cause);
        return exception;
    }
}
