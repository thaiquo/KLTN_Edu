package iuh.fit.learning_service.service;

import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import iuh.fit.learning_service.exception.CommunityRewriteUnavailableException;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class CommunityRewriteClientTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF";

    @Test void sendsMinimalScopedRequestAndFailsClosed() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicReference<String> token = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        AtomicInteger status = new AtomicInteger(200);
        server.createContext("/api/ai/internal/community/rewrite", exchange -> {
            token.set(exchange.getRequestHeaders().getFirst("X-Service-Token"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = "{\"canRewrite\":true,\"suggestedTitle\":\"Tiêu đề\","
                    .concat("\"suggestedContent\":\"Nội dung\",\"summaryOfChanges\":\"Đã sửa\"}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status.get(), bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        try {
            CommunityRewriteClient client = new CommunityRewriteClient(
                    SECRET, "http://127.0.0.1:" + server.getAddress().getPort());
            CommunityRewriteClient.Request request = new CommunityRewriteClient.Request(
                    "TUTOR_POLL", "title", "content", "REJECTED", List.of("SPAM"), "reason");
            assertTrue(client.rewrite(request).canRewrite());
            var claims = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                    .build().parseSignedClaims(token.get()).getPayload();
            assertEquals("learning-service", claims.getSubject());
            assertEquals("community-rewrite", claims.get("serviceScope"));
            assertFalse(body.get().contains("userId"));
            assertFalse(body.get().contains("authorId"));
            assertFalse(body.get().contains("email"));

            status.set(503);
            assertThrows(CommunityRewriteUnavailableException.class, () -> client.rewrite(request));
        } finally {
            server.stop(0);
        }
    }
}
