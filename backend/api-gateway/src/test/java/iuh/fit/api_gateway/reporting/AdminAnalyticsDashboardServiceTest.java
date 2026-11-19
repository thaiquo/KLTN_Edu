package iuh.fit.api_gateway.reporting;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminAnalyticsDashboardServiceTest {
    @Test
    void keepsOperationalChartsWhenFinancialSourceIsUnavailable() throws Exception {
        HttpServer contract = server(exchange -> respond(exchange, 503, "{\"message\":\"down\"}"));
        try {
            OperationalWorkItemService operational = operational(false);
            var service = new AdminAnalyticsDashboardService(operational, WebClient.builder(), url(contract), Duration.ofSeconds(15));

            var response = service.dashboard("access_token=redacted", null, 30).block(Duration.ofSeconds(5));

            assertThat(response).isNotNull();
            assertThat(response.operational().status()).isEqualTo("SUCCESS");
            assertThat(response.operational().data()).isNotNull();
            assertThat(response.financial().status()).isEqualTo("UNAVAILABLE");
            assertThat(response.financial().data()).isNull();
            assertThat(response.financial().errorCode()).isEqualTo("HTTP_503");
        } finally {
            contract.stop(0);
        }
    }

    @Test
    void exposesPartialOperationalStateWithoutHidingFinancialTrend() throws Exception {
        HttpServer contract = server(exchange -> respond(exchange, 200,
                "{\"rangeDays\":90,\"series\":[{\"currency\":\"USDC\",\"points\":[]}]}"));
        try {
            var service = new AdminAnalyticsDashboardService(operational(true), WebClient.builder(), url(contract), Duration.ofSeconds(15));
            var response = service.dashboard(null, "Bearer redacted", 90).block(Duration.ofSeconds(5));

            assertThat(response.operational().status()).isEqualTo("PARTIAL");
            assertThat(response.financial().status()).isEqualTo("SUCCESS");
            assertThat(response.rangeDays()).isEqualTo(90);
        } finally {
            contract.stop(0);
        }
    }

    private OperationalWorkItemService operational(boolean partial) {
        OperationalWorkItemService service = mock(OperationalWorkItemService.class);
        var sla = new OperationalWorkItemService.SlaSummary(2, 1, 1, 0, false, Map.of(), List.of());
        var data = new OperationalWorkItemService.OperationalAnalytics("V1", List.of(), sla, List.of(), partial,
                false, partial ? List.of("DISPUTE") : List.of(), List.of());
        when(service.dashboardAnalytics(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Mono.just(data));
        return service;
    }

    private HttpServer server(com.sun.net.httpserver.HttpHandler handler) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", handler);
        server.start();
        return server;
    }

    private String url(HttpServer server) { return "http://127.0.0.1:" + server.getAddress().getPort(); }

    private void respond(HttpExchange exchange, int status, String body) throws java.io.IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) { output.write(bytes); }
    }
}
