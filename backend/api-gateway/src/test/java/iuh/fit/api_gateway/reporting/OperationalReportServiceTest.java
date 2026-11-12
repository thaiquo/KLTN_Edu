package iuh.fit.api_gateway.reporting;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OperationalReportServiceTest {
    private final OperationalReportService service = new OperationalReportService(
            new ObjectMapper(), "http://account", "http://learning", "http://contract");

    @Test
    void paginatesZeroOneTenElevenOneHundredAndMoreThanTwoHundredFiftyWithoutLoss() {
        for (int count : List.of(0, 1, 10, 11, 100, 260)) {
            List<OperationalReportService.SourceResult> sources = interleaved(count);
            List<String> ids = new ArrayList<>();
            int totalPages = Math.max(1, (int) Math.ceil((double) count / 10));
            for (int page = 0; page < totalPages; page++) {
                var result = service.merge(sources, page, 10);
                ids.addAll(result.content().stream().map(OperationalReportService.Activity::id).toList());
                assertEquals(count, result.totalElements());
            }
            assertEquals(count, ids.size());
            assertEquals(count, new HashSet<>(ids).size());
        }
    }

    @Test
    void preservesGlobalChronologicalOrderAcrossInterleavedSources() {
        var page = service.merge(interleaved(25), 0, 20);
        List<Instant> timestamps = page.content().stream().map(item -> Instant.parse(item.at())).toList();
        for (int i = 1; i < timestamps.size(); i++) {
            assertTrue(!timestamps.get(i).isAfter(timestamps.get(i - 1)));
        }
    }

    @Test
    void summarizesAllFilteredRowsAndGroupsStaffWithoutCountingFailuresAsRejections() {
        var rows = List.of(new OperationalReportService.SourceResult("classes", 5, List.of(
                new OperationalReportService.Activity("1", "2026-10-29T12:00:00Z", "staff-a@test.vn", "CLASS_ROOMS", "review", "A", "APPROVED", null, 0),
                new OperationalReportService.Activity("2", "2026-10-29T11:00:00Z", "staff-a@test.vn", "CLASS_ROOMS", "review", "B", "REJECTED", null, 1),
                new OperationalReportService.Activity("3", "2026-10-29T10:00:00Z", "staff-b@test.vn", "DISPUTES", "resolve", "C", "RESOLVED", null, 2),
                new OperationalReportService.Activity("4", "2026-10-29T09:00:00Z", "staff-b@test.vn", "DISPUTES", "resolve", "D", "FAILED_RETRYABLE", null, 3),
                new OperationalReportService.Activity("5", "2026-10-29T08:00:00Z", null, "TERMINATIONS", "system", "E", "PENDING", null, 4)
        )));

        var summary = service.summarize(rows);

        assertEquals(5, summary.total());
        assertEquals(2, summary.approved());
        assertEquals(1, summary.rejected());
        assertEquals(66.666, summary.approvalRate(), 0.01);
        assertEquals(2, summary.staffPerformance().size());
        assertEquals(2, summary.staffPerformance().getFirst().total());
    }

    @Test
    void exportIncludesAllRowsAndNeutralizesSpreadsheetFormulaValues() throws Exception {
        HttpServer server = server(exchange -> respond(exchange, 200,
                "{\"content\":[{\"applicationId\":1,\"reviewedAt\":\"2026-10-29T12:00:00Z\","
                        + "\"reviewedByEmail\":\"=unsafe\",\"status\":\"APPROVED\"}],\"totalElements\":1}"));
        try {
            OperationalReportService live = service(server);
            byte[] bytes = live.exportCsv(new OperationalReportService.Query(
                    0, 1, "TUTOR_PROFILES", "ALL", "ALL", null, null, null), null, null)
                    .block(Duration.ofSeconds(5));
            String csv = new String(bytes, StandardCharsets.UTF_8);
            assertTrue(csv.startsWith("\uFEFFThời gian"));
            assertTrue(csv.contains("\"'=unsafe\""));
            assertTrue(csv.contains("APPROVED"));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void aggregateLimitFailsAfterPreflightWithoutDownloadingEveryPage() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = server(exchange -> {
            calls.incrementAndGet();
            respond(exchange, 200, "{\"content\":[],\"totalElements\":10001}");
        });
        try {
            OperationalReportService live = service(server);
            assertThrows(OperationalReportService.ReportLimitExceededException.class, () ->
                    live.summary(new OperationalReportService.Query(
                                    0, 1, "TUTOR_PROFILES", "ALL", "ALL", null, null, null), null, null)
                            .block(Duration.ofSeconds(5)));
            assertEquals(1, calls.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void usesDomainAndSourceRankAsDeterministicTimestampTieBreaker() {
        String at = "2026-10-29T10:00:00Z";
        var tutors = new OperationalReportService.SourceResult("tutors", 2, List.of(
                activity("tutor-2", at, "TUTOR_PROFILES", 0),
                activity("tutor-1", at, "TUTOR_PROFILES", 1)));
        var classes = new OperationalReportService.SourceResult("classes", 1, List.of(
                activity("class-1", at, "CLASS_ROOMS", 0)));

        var result = service.merge(List.of(tutors, classes), 0, 10);

        assertEquals(List.of("class-1", "tutor-2", "tutor-1"),
                result.content().stream().map(OperationalReportService.Activity::id).toList());
    }

    @Test
    void deepPageUsesOnlyTheRequiredPrefixFromEachSource() {
        int required = (27 + 1) * 10;
        int callsPerLargeSource = (int) Math.ceil((double) required / OperationalReportService.SOURCE_PAGE_SIZE);
        assertEquals(6, callsPerLargeSource);
        assertTrue(required < 1_000);
    }

    @Test
    void forwardsFiltersAndAuthenticationBeforeSourcePagination() throws Exception {
        AtomicReference<String> query = new AtomicReference<>();
        AtomicReference<String> cookie = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        HttpServer server = server(exchange -> {
            query.set(exchange.getRequestURI().getRawQuery());
            cookie.set(exchange.getRequestHeaders().getFirst("Cookie"));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            respond(exchange, 200, "{\"content\":[],\"totalElements\":0}");
        });
        try {
            OperationalReportService live = service(server);
            live.page(new OperationalReportService.Query(
                            0, 10, "TUTOR_PROFILES", "APPROVED", "staff@example.com",
                            "Nguyen", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"),
                    "access_token=redacted", "Bearer redacted").block(Duration.ofSeconds(5));

            String actual = java.net.URLDecoder.decode(query.get(), StandardCharsets.UTF_8);
            assertTrue(actual.contains("page=0"));
            assertTrue(actual.contains("size=10"));
            assertTrue(actual.contains("search=Nguyen"));
            assertTrue(actual.contains("reviewer=staff@example.com"));
            assertTrue(actual.contains("status=APPROVED"));
            assertTrue(actual.contains("from=2026-10-01T00:00:00Z"));
            assertTrue(actual.contains("to=2026-11-01T00:00:00Z"));
            assertEquals("access_token=redacted", cookie.get());
            assertEquals("Bearer redacted", authorization.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sourceFailureFailsTheWholeReportInsteadOfReturningPartialData() throws Exception {
        HttpServer server = server(exchange -> {
            if (exchange.getRequestURI().getPath().contains("tutor-subject-registrations")) {
                respond(exchange, 503, "{\"message\":\"source unavailable\"}");
            } else {
                respond(exchange, 200, "{\"content\":[],\"totalElements\":0}");
            }
        });
        try {
            OperationalReportService live = service(server);
            assertThrows(RuntimeException.class, () -> live.page(
                    new OperationalReportService.Query(0, 10, "ALL", "ALL", "ALL", null, null, null),
                    null, null).block(Duration.ofSeconds(5)));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void deepPageFetchesBoundedChunksAndStillReturnsRecordsBeyondFifty() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = server(exchange -> {
            calls.incrementAndGet();
            var parameters = queryParameters(exchange.getRequestURI().getRawQuery());
            int page = Integer.parseInt(parameters.get("page"));
            int size = Integer.parseInt(parameters.get("size"));
            int from = page * size;
            StringBuilder content = new StringBuilder("[");
            for (int index = from; index < Math.min(from + size, 300); index++) {
                if (index > from) content.append(',');
                content.append("{\"applicationId\":").append(index)
                        .append(",\"reviewedAt\":\"")
                        .append(Instant.parse("2026-10-29T23:00:00Z").minusSeconds(index))
                        .append("\",\"reviewedByEmail\":\"staff@test.vn\",\"status\":\"APPROVED\"}");
            }
            content.append(']');
            respond(exchange, 200, "{\"content\":" + content + ",\"totalElements\":300}");
        });
        try {
            OperationalReportService live = service(server);
            var result = live.page(new OperationalReportService.Query(
                            27, 10, "TUTOR_PROFILES", "ALL", "ALL", null, null, null),
                    null, null).block(Duration.ofSeconds(10));

            assertEquals(10, result.content().size());
            assertEquals("tutor-270", result.content().getFirst().id());
            assertEquals(6, calls.get());
        } finally {
            server.stop(0);
        }
    }

    private OperationalReportService service(HttpServer server) {
        String url = "http://127.0.0.1:" + server.getAddress().getPort();
        return new OperationalReportService(new ObjectMapper(), url, url, url);
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

    private java.util.Map<String, String> queryParameters(String query) {
        java.util.Map<String, String> result = new java.util.HashMap<>();
        for (String pair : query.split("&")) {
            String[] parts = pair.split("=", 2);
            result.put(parts[0], parts.length == 2 ? parts[1] : "");
        }
        return result;
    }

    private List<OperationalReportService.SourceResult> interleaved(int total) {
        List<OperationalReportService.Activity> first = new ArrayList<>();
        List<OperationalReportService.Activity> second = new ArrayList<>();
        Instant start = Instant.parse("2026-10-29T12:00:00Z");
        for (int i = 0; i < total; i++) {
            var item = activity("item-" + i, start.minus(i, ChronoUnit.SECONDS).toString(),
                    i % 2 == 0 ? "CLASS_ROOMS" : "DISPUTES", i / 2);
            (i % 2 == 0 ? first : second).add(item);
        }
        return List.of(
                new OperationalReportService.SourceResult("classes", first.size(), first),
                new OperationalReportService.SourceResult("disputes", second.size(), second));
    }

    private OperationalReportService.Activity activity(String id, String at, String domain, int rank) {
        return new OperationalReportService.Activity(
                id, at, "staff@educonnect.test", domain, "type", "target", "APPROVED", null, rank);
    }
}
