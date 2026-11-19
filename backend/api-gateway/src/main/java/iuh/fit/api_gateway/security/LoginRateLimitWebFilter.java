package iuh.fit.api_gateway.security;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class LoginRateLimitWebFilter implements WebFilter {
    private static final String LOGIN_PATH = "/api/auth/login";
    private final GatewayLoginRateLimiter rateLimiter;
    private final ClientIpResolver clientIpResolver;
    private final CorsConfiguration corsConfiguration;

    public LoginRateLimitWebFilter(
            GatewayLoginRateLimiter rateLimiter,
            ClientIpResolver clientIpResolver,
            @Value("${CORS_ALLOWED_ORIGIN_PATTERNS:http://localhost:*,http://127.0.0.1:*}") String allowedOriginPatterns
    ) {
        this.rateLimiter = rateLimiter;
        this.clientIpResolver = clientIpResolver;
        this.corsConfiguration = new CorsConfiguration();
        this.corsConfiguration.setAllowedOriginPatterns(Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim).filter(value -> !value.isBlank()).toList());
        this.corsConfiguration.setAllowCredentials(true);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        if (exchange.getRequest().getMethod() != HttpMethod.POST
                || !LOGIN_PATH.equals(exchange.getRequest().getPath().value())) {
            return chain.filter(exchange);
        }

        return rateLimiter.consume(clientIpResolver.resolve(exchange))
                .onErrorResume(error -> writeError(exchange, HttpStatus.SERVICE_UNAVAILABLE,
                        "LOGIN_RATE_LIMIT_UNAVAILABLE", "Tạm thời không thể kiểm tra giới hạn đăng nhập.", null)
                        .then(Mono.empty()))
                .flatMap(decision -> decision.allowed()
                        ? chain.filter(exchange)
                        : writeError(exchange, HttpStatus.TOO_MANY_REQUESTS,
                                "LOGIN_RATE_LIMITED", "Quá nhiều lần đăng nhập. Vui lòng thử lại sau.",
                                decision.retryAfterSeconds()));
    }

    private Mono<Void> writeError(ServerWebExchange exchange, HttpStatus status,
                                  String code, String message, Long retryAfterSeconds) {
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        exchange.getResponse().getHeaders().setCacheControl("no-store");
        if (retryAfterSeconds != null) {
            exchange.getResponse().getHeaders().set("Retry-After", Long.toString(retryAfterSeconds));
        }
        applyCorsHeaders(exchange);
        byte[] body = ("{\"status\":" + status.value() + ",\"code\":\"" + code
                + "\",\"message\":\"" + message + "\"}").getBytes(StandardCharsets.UTF_8);
        return exchange.getResponse().writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(body)));
    }

    private void applyCorsHeaders(ServerWebExchange exchange) {
        String origin = exchange.getRequest().getHeaders().getOrigin();
        String allowedOrigin = origin == null ? null : corsConfiguration.checkOrigin(origin);
        if (allowedOrigin == null) return;
        exchange.getResponse().getHeaders().set(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, allowedOrigin);
        exchange.getResponse().getHeaders().set(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true");
        exchange.getResponse().getHeaders().set(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "Set-Cookie, Retry-After");
        exchange.getResponse().getHeaders().add(HttpHeaders.VARY, HttpHeaders.ORIGIN);
    }
}
