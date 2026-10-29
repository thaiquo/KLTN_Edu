package iuh.fit.learning_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class ContractServiceDispatcherTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF";

    @Test
    void sendsCompleteGovernanceSnapshotWithScopedServiceToken() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var token = new AtomicReference<String>();
        var requestBody = new AtomicReference<String>();
        server.createContext("/api/contracts/internal/classrooms/4/sessions/501/auto-propose", exchange -> {
            token.set(exchange.getRequestHeaders().getFirst("X-Service-Token"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"classroomId\":4,\"sessionId\":501,\"proposals\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            var dispatcher = new ContractServiceDispatcher(
                    "http://127.0.0.1:" + server.getAddress().getPort(), SECRET);
            var payload = new ContractServiceDispatcher.AutoProposePayload(
                    List.of(new ContractServiceDispatcher.StudentAttendanceOutcomeItem(10L, "BOTH_PRESENT")),
                    501L, 7, "TUTOR_ABSENT",
                    OffsetDateTime.parse("2026-10-28T08:00:00Z"),
                    "ATTENDANCE:4:7:v1", 8,
                    OffsetDateTime.parse("2026-10-29T08:00:00Z"));

            assertThat(dispatcher.dispatchAutoPropose(4L, 501L, payload)).isTrue();

            var claims = Jwts.parser()
                    .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                    .build().parseSignedClaims(token.get()).getPayload();
            assertThat(claims.getSubject()).isEqualTo("learning-service");
            assertThat(claims.get("serviceScope", String.class)).isEqualTo("contract-settlement");
            assertThat(claims.getExpiration()).isNotNull();

            var json = new ObjectMapper().readTree(requestBody.get());
            assertThat(json.path("learningSessionId").asLong()).isEqualTo(501L);
            assertThat(json.path("sessionSequence").asInt()).isEqualTo(7);
            assertThat(json.path("tutorAttendanceOutcome").asText()).isEqualTo("TUTOR_ABSENT");
            assertThat(json.path("finalizedAt").asText()).isEqualTo("2026-10-28T08:00Z");
            assertThat(json.path("sourceEventId").asText()).isEqualTo("ATTENDANCE:4:7:v1");
            assertThat(json.path("nextSessionSequence").asInt()).isEqualTo(8);
            assertThat(json.path("nextSessionStartAt").asText()).isEqualTo("2026-10-29T08:00Z");
        } finally {
            server.stop(0);
        }
    }
}
