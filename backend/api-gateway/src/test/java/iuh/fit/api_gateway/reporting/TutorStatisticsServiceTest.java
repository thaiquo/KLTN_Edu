package iuh.fit.api_gateway.reporting;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class TutorStatisticsServiceTest {
    @Test
    void keepsLearningStatisticsWhenContractSourceIsUnavailable() throws Exception {
        HttpServer learning = server(exchange -> respond(exchange, 200,
                "{\"teaching\":{\"activeClasses\":2},\"reviews\":{\"reviewCount\":3}}"));
        HttpServer contract = server(exchange -> respond(exchange, 503, "{\"message\":\"down\"}"));
        try {
            TutorStatisticsService service = new TutorStatisticsService(
                    WebClient.builder(), url(learning), url(contract), Duration.ofSeconds(15));
            var response = service.aggregate("access_token=redacted", null, 30).block(Duration.ofSeconds(20));

            assertNotNull(response);
            assertEquals("SUCCESS", response.learning().status());
            assertEquals(2, response.learning().data().path("teaching").path("activeClasses").asInt());
            assertEquals("UNAVAILABLE", response.income().status());
            assertEquals("HTTP_503", response.income().errorCode());
            assertNull(response.income().data());
        } finally {
            learning.stop(0);
            contract.stop(0);
        }
    }

    @Test
    void keepsIncomeStatisticsWhenLearningSourceIsUnavailable() throws Exception {
        HttpServer learning = server(exchange -> respond(exchange, 503, "{\"message\":\"down\"}"));
        HttpServer contract = server(exchange -> respond(exchange, 200,
                "{\"currency\":\"USDC\",\"releasedAmount\":25.6}"));
        try {
            TutorStatisticsService service = new TutorStatisticsService(
                    WebClient.builder(), url(learning), url(contract), Duration.ofSeconds(15));
            var response = service.aggregate("access_token=redacted", null, 30).block(Duration.ofSeconds(20));

            assertNotNull(response);
            assertEquals("UNAVAILABLE", response.learning().status());
            assertEquals("HTTP_503", response.learning().errorCode());
            assertNull(response.learning().data());
            assertEquals("SUCCESS", response.income().status());
            assertEquals(25.6, response.income().data().path("releasedAmount").asDouble());
        } finally {
            learning.stop(0);
            contract.stop(0);
        }
    }

    @Test
    void normalizesUnsupportedRangeToThirtyDays() throws Exception {
        HttpServer source = server(exchange -> respond(exchange, 200, "{}"));
        try {
            TutorStatisticsService service = new TutorStatisticsService(
                    WebClient.builder(), url(source), url(source), Duration.ofSeconds(15));
            var response = service.aggregate(null, "Bearer redacted", 365).block(Duration.ofSeconds(20));
            assertNotNull(response);
            assertEquals(30, response.rangeDays());
        } finally {
            source.stop(0);
        }
    }

    private HttpServer server(com.sun.net.httpserver.HttpHandler handler) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", handler);
        server.start();
        return server;
    }

    private String url(HttpServer server) {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private void respond(HttpExchange exchange, int status, String body) throws java.io.IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) { output.write(bytes); }
    }
}
