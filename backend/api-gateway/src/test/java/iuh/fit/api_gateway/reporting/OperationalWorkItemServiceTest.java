package iuh.fit.api_gateway.reporting;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Clock;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.assertj.core.api.Assertions.assertThat;

class OperationalWorkItemServiceTest {

    @Test
    void exposesVersionedIdentityAndRealAssignmentSemanticsAcrossSources() throws Exception {
        HttpServer server = server(exchange -> {
            String path = exchange.getRequestURI().getPath();
            if (path.contains("tutor-applications/pending")) {
                respond(exchange, 200, page("[{\"applicationId\":11,\"applicantFullName\":\"Tutor A\",\"status\":\"PENDING\",\"createdAt\":\"2026-11-17T08:00:00Z\"}]", 1));
            } else if (path.contains("moderation/queue")) {
                respond(exchange, 200, page("[{\"postId\":22,\"title\":\"Bài cần duyệt\",\"moderationStatus\":\"NEEDS_REVIEW\",\"contentRevision\":3,\"openReportCount\":1,\"createdAt\":\"2026-11-17T09:00:00Z\"}]", 1));
            } else if (path.contains("support/tickets")) {
                respond(exchange, 200, page("[{\"id\":\"ticket-33\",\"subject\":\"Cần hỗ trợ\",\"status\":\"OPEN\",\"assigneeId\":null,\"version\":4,\"createdAt\":\"2026-11-17T10:00:00Z\"}]", 1));
            } else if (path.contains("contracts/disputes")) {
                respond(exchange, 200, page("[{\"id\":\"dispute-44\",\"className\":\"Lớp Toán\",\"status\":\"OPEN\",\"classroomReviewerEmail\":\"staff@edu.vn\",\"tutorResponseDeadline\":\"2026-11-18T10:00:00Z\",\"createdAt\":\"2026-11-17T07:00:00Z\"}]", 1));
            } else {
                respond(exchange, 200, page("[]", 0));
            }
        });
        try {
            var result = service(server, server, server).page(0, 20, "access_token=redacted", null)
                    .block(Duration.ofSeconds(5));

            assertEquals("V1", result.contractVersion());
            assertEquals(4, result.totalElements());
            assertEquals(4, new HashSet<>(result.content().stream()
                    .map(item -> item.source() + ":" + item.resourceId() + ":" + item.workflowRevision())
                    .toList()).size());
            var community = result.content().stream().filter(item -> item.source().equals("COMMUNITY_MODERATION")).findFirst().orElseThrow();
            assertEquals("3", community.workflowRevision());
            assertTrue(!community.claimable());
            var support = result.content().stream().filter(item -> item.source().equals("SUPPORT_TICKET")).findFirst().orElseThrow();
            assertEquals("4", support.workflowRevision());
            assertTrue(support.claimable());
            var dispute = result.content().stream().filter(item -> item.source().equals("DISPUTE")).findFirst().orElseThrow();
            assertNotNull(dispute.dueAt());
            assertEquals("staff@edu.vn", dispute.assignee());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void unavailableContractSourceDoesNotHideAccountAndLearningQueues() throws Exception {
        HttpServer healthy = server(exchange -> respond(exchange, 200,
                exchange.getRequestURI().getPath().contains("support/tickets")
                        ? page("[{\"id\":\"ticket-1\",\"subject\":\"Help\",\"status\":\"OPEN\",\"version\":1,\"createdAt\":\"2026-11-17T10:00:00Z\"}]", 1)
                        : page("[]", 0)));
        HttpServer failed = server(exchange -> respond(exchange, 503, "{\"message\":\"down\"}"));
        try {
            var result = service(healthy, healthy, failed).page(0, 10, null, "Bearer redacted")
                    .block(Duration.ofSeconds(5));
            assertEquals(1, result.content().size());
            assertTrue(result.sources().stream().anyMatch(source -> source.source().equals("DISPUTE")
                    && source.status() == OperationalWorkItemService.SourceStatus.UNAVAILABLE));
            assertTrue(result.sources().stream().anyMatch(source -> source.source().equals("SUPPORT_TICKET")
                    && source.status() == OperationalWorkItemService.SourceStatus.SUCCESS));
            assertEquals(null, result.sourceTotals().get("DISPUTE"));
        } finally {
            healthy.stop(0);
            failed.stop(0);
        }
    }

    @Test
    void dashboardAnalyticsUsesAuthoritativeSourceTotalsAndAssignedWorkload() throws Exception {
        HttpServer server = server(exchange -> {
            String path = exchange.getRequestURI().getPath();
            if (path.contains("contracts/disputes")) {
                respond(exchange, 200, page("[{\"id\":\"d-1\",\"className\":\"Lớp A\",\"status\":\"OPEN\",\"classroomReviewerEmail\":\"staff@edu.vn\",\"createdAt\":\"2026-11-17T07:00:00Z\"}]", 1));
            } else {
                respond(exchange, 200, page("[]", 0));
            }
        });
        try {
            var result = service(server, server, server).dashboardAnalytics(null, "Bearer redacted")
                    .block(Duration.ofSeconds(5));

            assertThat(result).isNotNull();
            assertThat(result.workItemsBySource()).anyMatch(row -> row.source().equals("DISPUTE") && row.openCount() == 1L);
            assertThat(result.staffWorkload()).singleElement().satisfies(row -> {
                assertThat(row.assignee()).isEqualTo("staff@edu.vn");
                assertThat(row.assigned()).isEqualTo(1);
            });
            assertThat(result.partial()).isFalse();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void authorizationFailuresAreNotDowngradedToSourceHealth() throws Exception {
        HttpServer forbidden = server(exchange -> respond(exchange,
                exchange.getRequestURI().getPath().contains("tutor-applications/pending") ? 403 : 200,
                exchange.getRequestURI().getPath().contains("tutor-applications/pending")
                        ? "{\"message\":\"forbidden\"}"
                        : page("[]", 0)));
        try {
            assertThrows(WebClientResponseException.Forbidden.class,
                    () -> service(forbidden, forbidden, forbidden).page(0, 10, null, null)
                            .block(Duration.ofSeconds(5)));
        } finally {
            forbidden.stop(0);
        }
    }

    @Test
    void staffFacingWorkItemContractDoesNotSerializeAdminFinancialOrBlockchainFields() throws Exception {
        HttpServer server = server(exchange -> respond(exchange, 200,
                exchange.getRequestURI().getPath().contains("support/tickets")
                        ? page("[{\"id\":\"ticket-1\",\"subject\":\"Help\",\"status\":\"OPEN\",\"version\":1,\"createdAt\":\"2026-11-17T10:00:00Z\"}]", 1)
                        : page("[]", 0)));
        try {
            var result = service(server, server, server).page(0, 10, null, "Bearer redacted")
                    .block(Duration.ofSeconds(5));
            String responseBody = new ObjectMapper().writeValueAsString(result);

            assertFalse(responseBody.contains("platformAmountUsdc"));
            assertFalse(responseBody.contains("totalEscrowFundedUsdc"));
            assertFalse(responseBody.contains("transactionHash"));
            assertFalse(responseBody.contains("studentWallet"));
            assertFalse(responseBody.contains("tutorWallet"));
        } finally {
            server.stop(0);
        }
    }

    private OperationalWorkItemService service(HttpServer account, HttpServer learning, HttpServer contract) {
        return new OperationalWorkItemService(OperationalSlaPolicy.defaults(Clock.systemUTC()),
                url(account), url(learning), url(contract));
    }

    private String url(HttpServer server) {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private String page(String content, int total) {
        return "{\"content\":" + content + ",\"totalElements\":" + total + "}";
    }

    private HttpServer server(com.sun.net.httpserver.HttpHandler handler) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", handler);
        server.start();
        return server;
    }

    private void respond(HttpExchange exchange, int status, String body) throws java.io.IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
