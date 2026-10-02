package iuh.fit.contract_service.service;

import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class NotificationDispatcherAuthenticationTest {
    @Test void directContractNotificationsCarryScopedServiceToken() throws Exception {
        String secret = "direct-notification-test-secret-at-least-256-bits";
        var received = new CountDownLatch(1);
        var scope = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/notifications/internal/send", exchange -> {
            try {
                var claims = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                        .build().parseSignedClaims(exchange.getRequestHeaders().getFirst("X-Service-Token")).getPayload();
                if ("contract-service".equals(claims.getSubject())) {
                    scope.set(claims.get("serviceScope", String.class));
                }
                exchange.sendResponseHeaders(200, -1);
            } finally {
                exchange.close();
                received.countDown();
            }
        });
        server.start();
        try {
            var dispatcher = new NotificationDispatcher("http://127.0.0.1:" + server.getAddress().getPort(),
                    mock(TerminationNotificationOutbox.class), secret);
            dispatcher.sendAsync("student@example.com", 2L, "Settlement", "Confirmed", "SETTLEMENT_COMPLETED", "AGREEMENT", "a1");
            assertThat(received.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(scope.get()).isEqualTo("notification-send");
        } finally {
            server.stop(0);
        }
    }
}
