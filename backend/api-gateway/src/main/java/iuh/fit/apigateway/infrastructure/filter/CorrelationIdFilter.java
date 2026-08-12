package iuh.fit.apigateway.infrastructure.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Component
public class CorrelationIdFilter implements GlobalFilter, Ordered {
    public static final String HEADER_NAME = "X-Correlation-ID";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String incoming = exchange.getRequest().getHeaders().getFirst(HEADER_NAME);
        String correlationId = StringUtils.hasText(incoming) ? incoming : UUID.randomUUID().toString();
        ServerWebExchange enriched = exchange.mutate()
            .request(request -> request.headers(headers -> headers.set(HEADER_NAME, correlationId)))
            .build();
        enriched.getResponse().getHeaders().set(HEADER_NAME, correlationId);
        return chain.filter(enriched);
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
