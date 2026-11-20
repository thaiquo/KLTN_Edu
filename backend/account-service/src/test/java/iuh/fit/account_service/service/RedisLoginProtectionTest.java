package iuh.fit.account_service.service;

import iuh.fit.account_service.config.LoginProtectionProperties;
import iuh.fit.account_service.exception.LoginProtectionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.security.authentication.BadCredentialsException;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RedisLoginProtectionTest {
    private FakeStore store;
    private LoginProtectionProperties properties;

    @BeforeEach
    void setUp() {
        store = new FakeStore();
        properties = new LoginProtectionProperties();
        properties.setFailureThreshold(3);
        properties.setFailureWindow(Duration.ofMinutes(10));
        properties.setLockDuration(Duration.ofSeconds(2));
    }

    @Test
    void thirdCredentialFailureRequiresChallengeWithoutLeakingAccountExistence() {
        var protection = protection((token, ip) -> TurnstileVerifier.VerificationResult.VALID);

        assertBadCredentials(protection, "known@example.com", null);
        assertBadCredentials(protection, "known@example.com", null);
        assertThatThrownBy(() -> fail(protection, "known@example.com", null))
                .isInstanceOf(LoginProtectionException.class)
                .extracting("code").isEqualTo("LOGIN_CHALLENGE_REQUIRED");
        assertThat(store.failureCount("known@example.com")).isEqualTo(3);

        var unknown = protection((token, ip) -> TurnstileVerifier.VerificationResult.VALID);
        assertBadCredentials(unknown, "unknown@example.com", null);
        assertThat(store.failureCount("unknown@example.com")).isEqualTo(1);
    }

    @Test
    void thresholdAppliesAcrossRoleChoiceAndMissingOrInvalidTokenDoesNotIncrement() {
        store.failures.put("same@example.com", 3);
        var invalid = protection((token, ip) -> TurnstileVerifier.VerificationResult.INVALID);

        assertChallenge(() -> invalid.execute("same@example.com", null, "127.0.0.1", () -> "student"));
        assertChallenge(() -> invalid.execute("same@example.com", "bad-token", "127.0.0.1", () -> "tutor"));

        assertThat(store.failureCount("same@example.com")).isEqualTo(3);
    }

    @Test
    void validTokenStillCountsWrongPasswordAndSuccessfulLoginClearsCounter() {
        store.failures.put("user@example.com", 3);
        var protection = protection((token, ip) -> TurnstileVerifier.VerificationResult.VALID);

        assertChallenge(() -> fail(protection, "user@example.com", "valid-token"));
        assertThat(store.failureCount("user@example.com")).isEqualTo(4);

        assertThat(protection.execute("user@example.com", "fresh-token", "127.0.0.1", () -> "session"))
                .isEqualTo("session");
        assertThat(store.failureCount("user@example.com")).isZero();
    }

    @Test
    void mobileLoginUsesTemporaryLockoutInsteadOfAnUnavailableCaptcha() {
        var protection = protection((token, ip) -> TurnstileVerifier.VerificationResult.VALID);

        for (int attempt = 0; attempt < 2; attempt++) {
            assertThatThrownBy(() -> protection.executeMobile("mobile@example.com", "127.0.0.1", () -> {
                throw new BadCredentialsException("invalid");
            })).isInstanceOf(BadCredentialsException.class);
        }
        assertThatThrownBy(() -> protection.executeMobile("mobile@example.com", "127.0.0.1", () -> {
            throw new BadCredentialsException("invalid");
        })).isInstanceOf(LoginProtectionException.class)
                .extracting("code").isEqualTo("LOGIN_MOBILE_RETRY_LATER");
        assertThatThrownBy(() -> protection.executeMobile("mobile@example.com", "127.0.0.1", () -> "session"))
                .isInstanceOf(LoginProtectionException.class)
                .extracting("retryAfterSeconds").isEqualTo(600L);

        store.clearFailures("mobile@example.com");
        assertThat(protection.executeMobile("mobile@example.com", "127.0.0.1", () -> "session"))
                .isEqualTo("session");
    }

    @Test
    void providerAndRedisFailuresFailClosedWithStableCode() {
        store.failures.put("user@example.com", 3);
        var unavailable = protection((token, ip) -> TurnstileVerifier.VerificationResult.UNAVAILABLE);
        assertUnavailable(() -> unavailable.execute("user@example.com", "token", "127.0.0.1", () -> "ok"));

        store.failOnRead = true;
        var redisFailure = protection((token, ip) -> TurnstileVerifier.VerificationResult.VALID);
        assertUnavailable(() -> redisFailure.execute("redis@example.com", null, "127.0.0.1", () -> "ok"));
    }

    @Test
    void concurrentRequestsForSameEmailCannotAllCrossThreshold() throws Exception {
        var protection = protection((token, ip) -> TurnstileVerifier.VerificationResult.VALID);
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> protection.execute("race@example.com", null, "127.0.0.1", () -> {
                entered.countDown();
                await(release);
                throw new BadCredentialsException("invalid");
            }));
            assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();

            assertThatThrownBy(() -> protection.execute("race@example.com", null, "127.0.0.1", () -> "bypass"))
                    .isInstanceOf(LoginProtectionException.class)
                    .extracting("code").isEqualTo("LOGIN_ATTEMPT_IN_PROGRESS");
            release.countDown();
            assertThatThrownBy(first::get).hasCauseInstanceOf(BadCredentialsException.class);
        }
        assertThat(store.failureCount("race@example.com")).isEqualTo(1);
    }

    private RedisLoginProtection protection(TurnstileVerifier verifier) {
        return new RedisLoginProtection(store, verifier, properties);
    }

    private void fail(RedisLoginProtection protection, String email, String token) {
        protection.execute(email, token, "127.0.0.1", () -> {
            throw new BadCredentialsException("Invalid email or password");
        });
    }

    private void assertBadCredentials(RedisLoginProtection protection, String email, String token) {
        assertThatThrownBy(() -> fail(protection, email, token)).isInstanceOf(BadCredentialsException.class);
    }

    private void assertChallenge(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call).isInstanceOf(LoginProtectionException.class)
                .extracting("code").isEqualTo("LOGIN_CHALLENGE_REQUIRED");
    }

    private void assertUnavailable(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call).isInstanceOf(LoginProtectionException.class)
                .extracting("code").isEqualTo("LOGIN_PROTECTION_UNAVAILABLE");
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(2, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private static final class FakeStore implements LoginAttemptStore {
        private final Map<String, Integer> failures = new ConcurrentHashMap<>();
        private final Map<String, String> leases = new ConcurrentHashMap<>();
        private volatile boolean failOnRead;

        @Override
        public String tryAcquire(String email, Duration leaseDuration) {
            String token = "lease-" + Thread.currentThread().threadId();
            return leases.putIfAbsent(email, token) == null ? token : null;
        }

        @Override
        public int failureCount(String email) {
            if (failOnRead) throw new DataAccessResourceFailureException("redis unavailable");
            return failures.getOrDefault(email, 0);
        }

        @Override
        public long remainingFailureWindowSeconds(String email) {
            return failures.containsKey(email) ? 600 : 0;
        }

        @Override
        public int recordFailure(String email, Duration failureWindow) {
            return failures.merge(email, 1, Integer::sum);
        }

        @Override
        public void clearFailures(String email) {
            failures.remove(email);
        }

        @Override
        public void release(String email, String leaseToken) {
            leases.remove(email, leaseToken);
        }
    }
}
