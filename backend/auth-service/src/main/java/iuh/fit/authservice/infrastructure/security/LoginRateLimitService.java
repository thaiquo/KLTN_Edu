package iuh.fit.authservice.infrastructure.security;

import iuh.fit.authservice.infrastructure.config.LoginSecurityProperties;
import iuh.fit.authservice.shared.exception.UnauthorizedException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Locale;

@Service
public class LoginRateLimitService {

    private final StringRedisTemplate redisTemplate;
    private final LoginSecurityProperties properties;

    public LoginRateLimitService(StringRedisTemplate redisTemplate, LoginSecurityProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    public void ensureAllowed(String email, String ipAddress) {
        String blockedKey = blockedKey(email, ipAddress);
        if (Boolean.TRUE.equals(redisTemplate.hasKey(blockedKey))) {
            throw new UnauthorizedException("Too many login attempts. Try again later.");
        }
    }

    public void registerFailure(String email, String ipAddress) {
        String attemptsKey = attemptsKey(email, ipAddress);
        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        if (attempts != null && attempts == 1L) {
            redisTemplate.expire(attemptsKey, Duration.ofMinutes(properties.getWindowMinutes()));
        }
        if (attempts != null && attempts >= properties.getMaxAttempts()) {
            redisTemplate.opsForValue().set(blockedKey(email, ipAddress), "1", Duration.ofMinutes(properties.getBlockMinutes()));
            redisTemplate.delete(attemptsKey);
        }
    }

    public void reset(String email, String ipAddress) {
        redisTemplate.delete(attemptsKey(email, ipAddress));
        redisTemplate.delete(blockedKey(email, ipAddress));
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
}