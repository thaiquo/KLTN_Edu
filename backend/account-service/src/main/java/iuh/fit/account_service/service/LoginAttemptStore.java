package iuh.fit.account_service.service;

import java.time.Duration;

public interface LoginAttemptStore {
    String tryAcquire(String normalizedEmail, Duration leaseDuration);
    int failureCount(String normalizedEmail);
    int recordFailure(String normalizedEmail, Duration failureWindow);
    void clearFailures(String normalizedEmail);
    void release(String normalizedEmail, String leaseToken);
}
