package iuh.fit.account_service.service;

import com.sun.net.httpserver.HttpServer;
import iuh.fit.account_service.config.TurnstileProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CloudflareTurnstileVerifierTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void acceptsValidProductionActionAndHostname() throws Exception {
        var verifier = verifier(200, """
                {"success":true,"hostname":"educonnect.example","action":"login"}
                """);

        assertThat(verifier.verify("single-use-token", "203.0.113.5"))
                .isEqualTo(TurnstileVerifier.VerificationResult.VALID);
    }

    @Test
    void rejectsInvalidExpiredReusedAndMismatchedResponses() throws Exception {
        var invalid = verifier(200, """
                {"success":false,"error-codes":["timeout-or-duplicate"]}
                """);
        assertThat(invalid.verify("expired-or-reused", "203.0.113.5"))
                .isEqualTo(TurnstileVerifier.VerificationResult.INVALID);
        stopServer();
        server = null;

        var wrongAction = verifier(200, """
                {"success":true,"hostname":"educonnect.example","action":"other-action"}
                """);
        assertThat(wrongAction.verify("token", "203.0.113.5"))
                .isEqualTo(TurnstileVerifier.VerificationResult.INVALID);
        stopServer();
        server = null;

        var wrongHost = verifier(200, """
                {"success":true,"hostname":"evil.example","action":"login"}
                """);
        assertThat(wrongHost.verify("token", "203.0.113.5"))
                .isEqualTo(TurnstileVerifier.VerificationResult.INVALID);
    }

    @Test
    void classifiesProviderFailureAsUnavailable() throws Exception {
        var verifier = verifier(503, "provider unavailable");

        assertThat(verifier.verify("token", "203.0.113.5"))
                .isEqualTo(TurnstileVerifier.VerificationResult.UNAVAILABLE);
    }

    private CloudflareTurnstileVerifier verifier(int status, String responseBody) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/siteverify", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertThat(body).contains("secret=production-secret", "response=");
            byte[] response = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        var properties = new TurnstileProperties("production");
        properties.setEnabled(true);
        properties.setSecretKey("production-secret");
        properties.setExpectedAction("login");
        properties.setAllowedHostnames(List.of("educonnect.example"));
        properties.setConnectTimeout(Duration.ofSeconds(1));
        properties.setReadTimeout(Duration.ofSeconds(1));
        properties.setSiteverifyUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/siteverify");
        return new CloudflareTurnstileVerifier(properties, new ObjectMapper());
    }
}
