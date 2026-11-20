package iuh.fit.api_gateway.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class LoginRateLimitWebFilterTest {

    @Test
    void rejectsOnlyLoginPostWithNumericRetryAfter() {
        var properties = new LoginRateLimitProperties();
        var resolver = new ClientIpResolver(properties);
        GatewayLoginRateLimiter limiter = ip -> Mono.just(GatewayLoginRateLimiter.Decision.reject(17));
        var filter = filter(limiter, resolver);
        var exchange = exchange(HttpMethod.POST, "/api/auth/login", "http://localhost:5173");
        var downstreamCalls = new AtomicInteger();

        filter.filter(exchange, countingChain(downstreamCalls)).block();

        assertThat(downstreamCalls).hasValue(0);
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(exchange.getResponse().getHeaders().getFirst("Retry-After")).isEqualTo("17");
        assertThat(exchange.getResponse().getHeaders().getFirst("Access-Control-Allow-Origin"))
                .isEqualTo("http://localhost:5173");
        assertThat(exchange.getResponse().getHeaders().getFirst("Access-Control-Expose-Headers"))
                .contains("Retry-After");
        assertThat(body(exchange)).contains("LOGIN_RATE_LIMITED");
    }

    @Test
    void bypassesOptionsAndUnrelatedRoutes() {
        var properties = new LoginRateLimitProperties();
        var resolver = new ClientIpResolver(properties);
        var limiterCalls = new AtomicInteger();
        GatewayLoginRateLimiter limiter = ip -> {
            limiterCalls.incrementAndGet();
            return Mono.just(GatewayLoginRateLimiter.Decision.reject(10));
        };
        var filter = filter(limiter, resolver);
        var downstreamCalls = new AtomicInteger();

        filter.filter(exchange(HttpMethod.OPTIONS, "/api/auth/login", null), countingChain(downstreamCalls)).block();
        filter.filter(exchange(HttpMethod.POST, "/api/auth/csrf", null), countingChain(downstreamCalls)).block();

        assertThat(limiterCalls).hasValue(0);
        assertThat(downstreamCalls).hasValue(2);
    }

    @Test
    void mobileLoginUsesTheSameIpRateLimit() {
        var properties = new LoginRateLimitProperties();
        var resolver = new ClientIpResolver(properties);
        GatewayLoginRateLimiter limiter = ip -> Mono.just(GatewayLoginRateLimiter.Decision.reject(17));
        var exchange = exchange(HttpMethod.POST, "/api/auth/mobile/login", null);
        var downstreamCalls = new AtomicInteger();

        filter(limiter, resolver).filter(exchange, countingChain(downstreamCalls)).block();

        assertThat(downstreamCalls).hasValue(0);
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(exchange.getResponse().getHeaders().getFirst("Retry-After")).isEqualTo("17");
    }

    @Test
    void failsClosedWhenRedisLimiterIsUnavailable() {
        var properties = new LoginRateLimitProperties();
        var resolver = new ClientIpResolver(properties);
        GatewayLoginRateLimiter limiter = ip -> Mono.error(new IllegalStateException("redis unavailable"));
        var filter = filter(limiter, resolver);
        var exchange = exchange(HttpMethod.POST, "/api/auth/login", "https://untrusted.example");

        filter.filter(exchange, countingChain(new AtomicInteger())).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(body(exchange)).contains("LOGIN_RATE_LIMIT_UNAVAILABLE");
        assertThat(exchange.getResponse().getHeaders().getFirst("Access-Control-Allow-Origin")).isNull();
    }

    private static LoginRateLimitWebFilter filter(GatewayLoginRateLimiter limiter, ClientIpResolver resolver) {
        return new LoginRateLimitWebFilter(limiter, resolver, "http://localhost:*,http://127.0.0.1:*");
    }

    private static MockServerWebExchange exchange(HttpMethod method, String path, String origin) {
        var builder = MockServerHttpRequest.method(method, path)
                .remoteAddress(new InetSocketAddress("203.0.113.7", 50000));
        if (origin != null) builder.header("Origin", origin);
        var request = builder.build();
        return MockServerWebExchange.from(request);
    }

    private static WebFilterChain countingChain(AtomicInteger calls) {
        return exchange -> {
            calls.incrementAndGet();
            return Mono.empty();
        };
    }

    private static String body(MockServerWebExchange exchange) {
        return exchange.getResponse().getBody()
                .map(buffer -> StandardCharsets.UTF_8.decode(buffer.asByteBuffer()).toString())
                .collectList().map(parts -> String.join("", parts)).block();
    }
}
