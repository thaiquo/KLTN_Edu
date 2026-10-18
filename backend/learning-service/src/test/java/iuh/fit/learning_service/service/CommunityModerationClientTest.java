package iuh.fit.learning_service.service;

import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class CommunityModerationClientTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF";
    @Test void sendsMinimalPayloadAndScopedServiceTokenAndFailsClosed() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicReference<String> token = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        AtomicReference<String> response = new AtomicReference<>("{\"recommendation\":\"ALLOW\",\"riskLevel\":\"LOW\",\"categories\":[],\"reason\":\"ok\",\"model\":\"m\",\"promptVersion\":\"v1\",\"generatedAt\":\"2026-01-01T00:00:00Z\"}");
        server.createContext("/api/ai/internal/community/moderate", exchange -> {
            token.set(exchange.getRequestHeaders().getFirst("X-Service-Token"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = response.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        try {
            var client = new CommunityModerationClient(SECRET, "http://127.0.0.1:" + server.getAddress().getPort());
            var request = new CommunityModerationClient.Request("TUTOR_POLL", "title", "content");
            assertEquals(CommunityModerationPolicy.Recommendation.ALLOW, client.moderate(request).recommendation());
            var claims = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                    .build().parseSignedClaims(token.get()).getPayload();
            assertEquals("learning-service", claims.getSubject());
            assertEquals("community-moderation", claims.get("serviceScope"));
            assertNotNull(claims.getExpiration());
            assertEquals("{\"postType\":\"TUTOR_POLL\",\"title\":\"title\",\"content\":\"content\"}", body.get());
            response.set("{\"recommendation\":\"NOT_REAL\"}");
            assertNull(client.moderate(request));
        } finally {
            server.stop(0);
        }
    }
}
