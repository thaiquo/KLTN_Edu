package iuh.fit.account_service.infrastructure.security;

import iuh.fit.account_service.infrastructure.config.LoginSecurityProperties;
import iuh.fit.account_service.shared.exception.UnauthorizedException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginRateLimitService {

    private final StringRedisTemplate redisTemplate;
    private final LoginSecurityProperties properties;
    private final ConcurrentHashMap<String, LocalAttempt> localAttempts = new ConcurrentHashMap<>();

    public LoginRateLimitService(StringRedisTemplate redisTemplate, LoginSecurityProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    public void ensureAllowed(String email, String ipAddress) {
        String blockedKey = blockedKey(email, ipAddress);
        try {
            if (Boolean.TRUE.equals(redisTemplate.hasKey(blockedKey))) {
                throw new UnauthorizedException("Too many login attempts. Try again later.");
            }
        } catch (DataAccessException exception) {
            LocalAttempt attempt = localAttempts.get(attemptsKey(email, ipAddress));
            if (attempt != null && attempt.blockedUntil() != null && attempt.blockedUntil().isAfter(Instant.now())) {
                throw new UnauthorizedException("Too many login attempts. Try again later.");
            }
        }
    }

    public void registerFailure(String email, String ipAddress) {
        String attemptsKey = attemptsKey(email, ipAddress);
        try {
            Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
            if (attempts != null && attempts == 1L) {
                redisTemplate.expire(attemptsKey, Duration.ofMinutes(properties.getWindowMinutes()));
            }
            if (attempts != null && attempts >= properties.getMaxAttempts()) {
                redisTemplate.opsForValue().set(blockedKey(email, ipAddress), "1", Duration.ofMinutes(properties.getBlockMinutes()));
                redisTemplate.delete(attemptsKey);
            }
        } catch (DataAccessException exception) {
            localAttempts.compute(attemptsKey, (key, current) -> nextLocalAttempt(current));
        }
    }

    public void reset(String email, String ipAddress) {
        String attemptsKey = attemptsKey(email, ipAddress);
        try {
            redisTemplate.delete(attemptsKey);
            redisTemplate.delete(blockedKey(email, ipAddress));
        } catch (DataAccessException exception) {
            localAttempts.remove(attemptsKey);
        }
    }

    private String attemptsKey(String email, String ipAddress) {
        return "auth:login:attempts:" + normalize(email) + ":" + normalize(ipAddress);
    }

    private String blockedKey(String email, String ipAddress) {
        return "auth:login:block:" + normalize(email) + ":" + normalize(ipAddress);
    }

    private String normalize(String value) {
        return value == null ? "unknown" : value.trim().toLowerCase(Locale.ROOT);
    }

    private LocalAttempt nextLocalAttempt(LocalAttempt current) {
        Instant now = Instant.now();
        int attempts = current == null || current.windowEndsAt().isBefore(now) ? 1 : current.attempts() + 1;
        Instant windowEnds = current == null || current.windowEndsAt().isBefore(now)
            ? now.plus(Duration.ofMinutes(properties.getWindowMinutes()))
            : current.windowEndsAt();
        Instant blockedUntil = attempts >= properties.getMaxAttempts()
            ? now.plus(Duration.ofMinutes(properties.getBlockMinutes()))
            : null;
        return new LocalAttempt(attempts, windowEnds, blockedUntil);
    }

    private record LocalAttempt(int attempts, Instant windowEndsAt, Instant blockedUntil) {
    }
}
