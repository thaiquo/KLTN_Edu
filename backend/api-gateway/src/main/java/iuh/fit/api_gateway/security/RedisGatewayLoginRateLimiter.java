package iuh.fit.api_gateway.security;

import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

@Component
public class RedisGatewayLoginRateLimiter implements GatewayLoginRateLimiter {
    private static final DefaultRedisScript<List> FIXED_WINDOW_SCRIPT = new DefaultRedisScript<>("""
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then
              redis.call('PEXPIRE', KEYS[1], ARGV[1])
            end
            local ttl = redis.call('PTTL', KEYS[1])
            return {count, ttl}
            """, List.class);

    private final ReactiveStringRedisTemplate redisTemplate;
    private final LoginRateLimitProperties properties;

    public RedisGatewayLoginRateLimiter(ReactiveStringRedisTemplate redisTemplate,
                                        LoginRateLimitProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    @Override
    public Mono<Decision> consume(String clientIp) {
        if (!properties.isEnabled()) return Mono.just(Decision.allow());
        String key = "security:login:ip:" + sha256(clientIp);
        long windowMillis = Math.max(1_000, properties.getWindow().toMillis());
        return redisTemplate.execute(
                        FIXED_WINDOW_SCRIPT,
                        List.of(key),
                        List.of(Long.toString(windowMillis)))
                .next()
                .switchIfEmpty(Mono.error(new IllegalStateException("Redis returned no rate-limit result")))
                .map(result -> {
                    long count = ((Number) result.get(0)).longValue();
                    long ttlMillis = ((Number) result.get(1)).longValue();
                    return count <= properties.getRequests()
                            ? Decision.allow()
                            : Decision.reject((ttlMillis + 999) / 1_000);
                });
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
