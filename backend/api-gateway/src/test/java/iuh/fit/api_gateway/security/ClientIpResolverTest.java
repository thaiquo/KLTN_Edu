package iuh.fit.api_gateway.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import java.net.InetSocketAddress;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ClientIpResolverTest {

    @Test
    void ignoresSpoofedForwardedHeaderFromUntrustedPeer() {
        var properties = new LoginRateLimitProperties();
        properties.setTrustedProxyCidrs(List.of("10.0.0.0/8"));
        var resolver = new ClientIpResolver(properties);

        var exchange = exchange("203.0.113.9", "198.51.100.22");

        assertThat(resolver.resolve(exchange)).isEqualTo("203.0.113.9");
    }

    @Test
    void resolvesFirstUntrustedHopBehindConfiguredProxyChain() {
        var properties = new LoginRateLimitProperties();
        properties.setTrustedProxyCidrs(List.of("10.0.0.0/8"));
        var resolver = new ClientIpResolver(properties);

        var exchange = exchange("10.0.0.2", "198.51.100.22, 10.0.0.1");

        assertThat(resolver.resolve(exchange)).isEqualTo("198.51.100.22");
    }

    @Test
    void rejectsHostnameInForwardedChainWithoutDnsResolution() {
        var properties = new LoginRateLimitProperties();
        properties.setTrustedProxyCidrs(List.of("10.0.0.0/8"));
        var resolver = new ClientIpResolver(properties);

        var exchange = exchange("10.0.0.2", "attacker.example, 10.0.0.1");

        assertThat(resolver.resolve(exchange)).isEqualTo("10.0.0.2");
    }

    private static MockServerWebExchange exchange(String remoteIp, String forwardedFor) {
        var request = MockServerHttpRequest.post("/api/auth/login")
                .remoteAddress(new InetSocketAddress(remoteIp, 50000))
                .header("X-Forwarded-For", forwardedFor)
                .build();
        return MockServerWebExchange.from(request);
    }
}
