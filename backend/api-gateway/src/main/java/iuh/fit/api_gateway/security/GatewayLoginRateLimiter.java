package iuh.fit.api_gateway.security;

import reactor.core.publisher.Mono;

public interface GatewayLoginRateLimiter {
    Mono<Decision> consume(String clientIp);

    record Decision(boolean allowed, long retryAfterSeconds) {
        public static Decision allow() { return new Decision(true, 0); }
        public static Decision reject(long retryAfterSeconds) {
            return new Decision(false, Math.max(1, retryAfterSeconds));
        }
    }
}
