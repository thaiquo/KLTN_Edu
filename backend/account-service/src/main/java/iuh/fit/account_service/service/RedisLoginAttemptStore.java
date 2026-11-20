package iuh.fit.account_service.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
public class RedisLoginAttemptStore implements LoginAttemptStore {
    private static final DefaultRedisScript<Long> INCREMENT_SCRIPT = new DefaultRedisScript<>("""
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then
              redis.call('PEXPIRE', KEYS[1], ARGV[1])
            end
            return count
            """, Long.class);
    private static final DefaultRedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('GET', KEYS[1]) == ARGV[1] then
              return redis.call('DEL', KEYS[1])
            end
            return 0
            """, Long.class);

    private final StringRedisTemplate redisTemplate;

    public RedisLoginAttemptStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public String tryAcquire(String normalizedEmail, Duration leaseDuration) {
        String token = UUID.randomUUID().toString();
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey(normalizedEmail), token, leaseDuration);
        return Boolean.TRUE.equals(acquired) ? token : null;
    }

    @Override
    public int failureCount(String normalizedEmail) {
        String value = redisTemplate.opsForValue().get(failureKey(normalizedEmail));
        if (value == null) return 0;
        try { return Integer.parseInt(value); }
        catch (NumberFormatException exception) { throw new IllegalStateException("Invalid Redis login counter"); }
    }

    @Override
    public long remainingFailureWindowSeconds(String normalizedEmail) {
        Long remaining = redisTemplate.getExpire(failureKey(normalizedEmail), TimeUnit.SECONDS);
        return remaining == null ? 0 : Math.max(0, remaining);
    }

    @Override
    public int recordFailure(String normalizedEmail, Duration failureWindow) {
        Long count = redisTemplate.execute(INCREMENT_SCRIPT, List.of(failureKey(normalizedEmail)),
                Long.toString(Math.max(1_000, failureWindow.toMillis())));
        if (count == null) throw new IllegalStateException("Redis returned no login counter");
        return Math.toIntExact(count);
    }

    @Override
    public void clearFailures(String normalizedEmail) {
        redisTemplate.delete(failureKey(normalizedEmail));
    }

    @Override
    public void release(String normalizedEmail, String leaseToken) {
        if (leaseToken != null) redisTemplate.execute(RELEASE_SCRIPT, List.of(lockKey(normalizedEmail)), leaseToken);
    }

    private String failureKey(String email) { return "security:login:email:" + digest(email); }
    private String lockKey(String email) { return "security:login:lock:" + digest(email); }

    private String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
