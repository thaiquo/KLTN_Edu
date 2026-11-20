package iuh.fit.api_gateway.reporting;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OperationalSlaNotificationPublisherTest {
    private static final String SECRET = "gateway-sla-notification-test-secret-at-least-256-bits";

    @Test
    void publishesSameDurableEventIdentityForRepeatedEvaluation() throws Exception {
        List<String> bodies = new CopyOnWriteArrayList<>();
        HttpServer account = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        account.createContext("/api/internal/notification-reviewers", exchange ->
                respond(exchange, 200, "[{\"recipientId\":7,\"targetRole\":\"ADMIN\"}]"));
        account.start();
        HttpServer notification = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        notification.createContext("/api/notifications/internal/send", exchange -> {
            bodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 200, "{\"success\":true}");
        });
        notification.start();
        try {
            var publisher = new OperationalSlaNotificationPublisher(url(account), url(notification), SECRET, true);
            var item = item("revision-3", OperationalSlaPolicy.SlaState.DUE_SOON);
            publisher.publish(List.of(item)).block();
            publisher.publish(List.of(item)).block();

            assertEquals(2, bodies.size());
            assertEquals(publisher.eventId(item), publisher.eventId(item));
            assertTrue(bodies.stream().allMatch(body -> body.contains(publisher.eventId(item))));
            assertTrue(bodies.stream().allMatch(body -> body.contains("OPERATIONAL_SLA_ALERT")));
        } finally {
            account.stop(0);
            notification.stop(0);
        }
    }

    @Test
    void eventIdentityChangesWhenThresholdOrWorkflowRevisionChanges() {
        var publisher = new OperationalSlaNotificationPublisher("http://localhost", "http://localhost", SECRET, false);
        assertNotEquals(publisher.eventId(item("revision-3", OperationalSlaPolicy.SlaState.DUE_SOON)),
                publisher.eventId(item("revision-3", OperationalSlaPolicy.SlaState.OVERDUE)));
        assertNotEquals(publisher.eventId(item("revision-3", OperationalSlaPolicy.SlaState.DUE_SOON)),
                publisher.eventId(item("revision-4", OperationalSlaPolicy.SlaState.DUE_SOON)));
    }

    private OperationalWorkItemService.WorkItemV1 item(String revision, OperationalSlaPolicy.SlaState state) {
        return new OperationalWorkItemService.WorkItemV1("SUPPORT_TICKET", "ticket-1", revision,
                "Yêu cầu hỗ trợ", "OPEN", OperationalWorkItemService.Priority.NORMAL, null,
                "2026-11-15T10:00:00Z", 1L, "2026-11-17T10:00:00Z", "?tab=help", true,
                OperationalWorkItemService.SourceStatus.SUCCESS, state, 30L, null,
                "support-ticket-v1", false, null);
    }

    private String url(HttpServer server) {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private void respond(com.sun.net.httpserver.HttpExchange exchange, int status, String body) throws java.io.IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) { output.write(bytes); }
    }
}
