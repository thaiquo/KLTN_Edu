package iuh.fit.api_gateway.reporting;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriBuilder;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

@Service
public class OperationalReportService {
    static final int SOURCE_PAGE_SIZE = 50;
    static final int MAX_GLOBAL_PAGE = 1_000;
    static final int MAX_AGGREGATE_ROWS = 10_000;

    private final WebClient account;
    private final WebClient learning;
    private final WebClient contract;
    private final ObjectMapper objectMapper;

    public OperationalReportService(
            ObjectMapper objectMapper,
            @Value("${reporting.sources.account:${ACCOUNT_SERVICE_URL:http://localhost:8081}}") String accountUrl,
            @Value("${reporting.sources.learning:${LEARNING_SERVICE_URL:http://localhost:8082}}") String learningUrl,
            @Value("${reporting.sources.contract:${CONTRACT_SERVICE_URL:http://localhost:8083}}") String contractUrl) {
        WebClient.Builder builder = WebClient.builder();
        this.account = builder.clone().baseUrl(accountUrl).build();
        this.learning = builder.clone().baseUrl(learningUrl).build();
        this.contract = builder.clone().baseUrl(contractUrl).build();
        this.objectMapper = objectMapper;
    }

    public Mono<ReportPage> page(Query query, String cookie, String authorization) {
        int page = Math.max(0, query.page());
        if (page > MAX_GLOBAL_PAGE) {
            return Mono.error(new IllegalArgumentException("Report page exceeds the supported deep-page limit"));
        }
        int size = Math.min(50, Math.max(1, query.size()));
        int required = Math.multiplyExact(page + 1, size);

        List<SourceRequest> sources = sources(query, cookie, authorization);
        if (sources.isEmpty()) return Mono.just(ReportPage.empty(page, size));

        return Flux.fromIterable(sources)
                .flatMap(source -> fetchSafe(source, required), sources.size())
                .collectList()
                .map(results -> merge(results, page, size));
    }

    public Mono<ReportSummary> summary(Query query, String cookie, String authorization) {
        return aggregate(query, cookie, authorization).map(this::summarize);
    }

    public Mono<byte[]> exportCsv(Query query, String cookie, String authorization) {
        return aggregate(query, cookie, authorization).map(this::toCsv);
    }

    private Mono<List<SourceResult>> aggregate(Query query, String cookie, String authorization) {
        List<SourceRequest> requestedSources = sources(query, cookie, authorization);
        if (requestedSources.isEmpty()) return Mono.just(List.of());
        return Flux.fromIterable(requestedSources)
                .flatMap(this::seedSafe, requestedSources.size())
                .collectList()
                .flatMap(seeds -> {
                    long total = seeds.stream()
                            .filter(SourceSeed::available)
                            .mapToLong(seed -> seed.first().totalElements())
                            .sum();
                    if (total > MAX_AGGREGATE_ROWS) {
                        return Mono.error(new ReportLimitExceededException(total, MAX_AGGREGATE_ROWS));
                    }
                    return Flux.fromIterable(seeds)
                            .flatMap(seed -> seed.available()
                                    ? fetchAllSafe(seed)
                                    : Mono.just(seed.failure()), seeds.size())
                            .collectList();
                });
    }

    ReportPage merge(List<SourceResult> sources, int page, int size) {
        List<Activity> all = sources.stream().flatMap(source -> source.items().stream()).sorted(ACTIVITY_ORDER).toList();
        int from = Math.min(page * size, all.size());
        int to = Math.min(from + size, all.size());
        long total = sources.stream().mapToLong(SourceResult::totalElements).sum();
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / size);
        Map<String, Long> totals = new LinkedHashMap<>();
        sources.forEach(source -> totals.put(source.name(), source.available() ? source.totalElements() : null));
        return new ReportPage(
                all.subList(from, to), total, totalPages, page, size,
                page == 0, page + 1 >= totalPages, from == to, totals,
                sources.stream().map(SourceResult::health).toList());
    }

    private Mono<SourceResult> fetchSafe(SourceRequest source, int required) {
        long started = System.nanoTime();
        return fetch(source, required)
                .map(result -> result.withHealth(successHealth(source.name(), started)))
                .onErrorResume(error -> authorizationFailure(error)
                        ? Mono.error(error)
                        : Mono.just(SourceResult.unavailable(source.name(), failureHealth(source.name(), started, error))));
    }

    private Mono<SourceSeed> seedSafe(SourceRequest source) {
        long started = System.nanoTime();
        return fetchPage(source, 0, SOURCE_PAGE_SIZE)
                .map(first -> SourceSeed.available(source, first, started))
                .onErrorResume(error -> authorizationFailure(error)
                        ? Mono.error(error)
                        : Mono.just(SourceSeed.unavailable(source,
                                SourceResult.unavailable(source.name(), failureHealth(source.name(), started, error)))));
    }

    private Mono<SourceResult> fetchAllSafe(SourceSeed seed) {
        return fetchAll(seed.source(), seed.first())
                .map(result -> result.withHealth(successHealth(seed.source().name(), seed.startedNanos())))
                .onErrorResume(error -> authorizationFailure(error)
                        ? Mono.error(error)
                        : Mono.just(SourceResult.unavailable(seed.source().name(),
                                failureHealth(seed.source().name(), seed.startedNanos(), error))));
    }

    private boolean authorizationFailure(Throwable error) {
        return error instanceof WebClientResponseException response
                && (response.getStatusCode().value() == 401 || response.getStatusCode().value() == 403);
    }

    private SourceHealth successHealth(String source, long startedNanos) {
        return new SourceHealth(source, SourceAvailability.SUCCESS, elapsedMillis(startedNanos),
                Instant.now().toString(), null);
    }

    private SourceHealth failureHealth(String source, long startedNanos, Throwable error) {
        String code = error instanceof WebClientResponseException response
                ? "HTTP_" + response.getStatusCode().value()
                : error.getClass().getSimpleName().toUpperCase(Locale.ROOT);
        return new SourceHealth(source, SourceAvailability.UNAVAILABLE, elapsedMillis(startedNanos), null, code);
    }

    private long elapsedMillis(long startedNanos) {
        return Math.max(0, (System.nanoTime() - startedNanos) / 1_000_000L);
    }

    private Mono<SourceResult> fetch(SourceRequest source, int required) {
        int chunk = Math.min(SOURCE_PAGE_SIZE, required);
        return fetchPage(source, 0, chunk).flatMap(first -> {
            int available = (int) Math.min(first.totalElements(), required);
            int pageCount = available == 0 ? 0 : (int) Math.ceil((double) available / chunk);
            if (pageCount <= 1) {
                return Mono.just(new SourceResult(source.name(), first.totalElements(), rank(first.items(), 0)));
            }
            return Flux.range(1, pageCount - 1)
                    .concatMap(index -> fetchPage(source, index, chunk))
                    .map(SourcePage::items)
                    .startWith(first.items())
                    .collectList()
                    .map(pages -> {
                        List<Activity> items = pages.stream().flatMap(List::stream).limit(required).toList();
                        return new SourceResult(source.name(), first.totalElements(), rank(items, 0));
                    });
        });
    }

    private Mono<SourceResult> fetchAll(SourceRequest source, SourcePage first) {
        return Mono.defer(() -> {
            int pageCount = first.totalElements() == 0
                    ? 0
                    : (int) Math.ceil((double) first.totalElements() / SOURCE_PAGE_SIZE);
            if (pageCount <= 1) {
                return Mono.just(new SourceResult(source.name(), first.items().size(), rank(first.items(), 0)));
            }
            return Flux.range(1, pageCount - 1)
                    .concatMap(index -> fetchPage(source, index, SOURCE_PAGE_SIZE))
                    .map(SourcePage::items)
                    .startWith(first.items())
                    .collectList()
                    .map(pages -> {
                        List<Activity> items = pages.stream().flatMap(List::stream).toList();
                        return new SourceResult(source.name(), items.size(), rank(items, 0));
                    });
        });
    }

    ReportSummary summarize(List<SourceResult> sources) {
        List<Activity> activities = sources.stream()
                .flatMap(source -> source.items().stream())
                .sorted(ACTIVITY_ORDER)
                .toList();
        long approved = activities.stream().filter(activity -> isApproved(activity.status())).count();
        long rejected = activities.stream().filter(activity -> isRejected(activity.status())).count();
        long decided = approved + rejected;
        Double approvalRate = decided == 0 ? null : approved * 100.0 / decided;

        Map<String, MutableStaffPerformance> staff = new LinkedHashMap<>();
        for (Activity activity : activities) {
            if (!StringUtils.hasText(activity.actor())) continue;
            String key = activity.actor().trim().toLowerCase(Locale.ROOT);
            staff.computeIfAbsent(key, ignored -> new MutableStaffPerformance(activity.actor())).accept(activity);
        }
        List<StaffPerformance> performance = staff.values().stream()
                .map(MutableStaffPerformance::toRecord)
                .sorted(Comparator.comparingLong(StaffPerformance::total).reversed()
                        .thenComparing(StaffPerformance::email))
                .toList();
        Map<String, Long> totals = new LinkedHashMap<>();
        sources.forEach(source -> totals.put(source.name(), source.available() ? (long) source.items().size() : null));
        return new ReportSummary(activities.size(), approved, rejected, approvalRate, totals, performance,
                sources.stream().map(SourceResult::health).toList());
    }

    private byte[] toCsv(List<SourceResult> sources) {
        List<Activity> activities = sources.stream()
                .flatMap(source -> source.items().stream())
                .sorted(ACTIVITY_ORDER)
                .toList();
        String successful = sources.stream().filter(SourceResult::available).map(SourceResult::name)
                .reduce((left, right) -> left + "|" + right).orElse("NONE");
        String unavailable = sources.stream().filter(source -> !source.available()).map(SourceResult::name)
                .reduce((left, right) -> left + "|" + right).orElse("NONE");
        StringBuilder csv = new StringBuilder("\uFEFFPhạm vi dữ liệu,Giá trị\r\n")
                .append(csv("Nguồn thành công")).append(',').append(csv(successful)).append("\r\n")
                .append(csv("Nguồn không khả dụng")).append(',').append(csv(unavailable)).append("\r\n\r\n")
                .append("Thời gian,Email người thao tác,Nghiệp vụ,Phân hệ,Đối tượng,Trạng thái,Ghi chú & Căn cứ\r\n");
        for (Activity activity : activities) {
            csv.append(csv(activity.at())).append(',')
                    .append(csv(activity.actor())).append(',')
                    .append(csv(activity.type())).append(',')
                    .append(csv(activity.domain())).append(',')
                    .append(csv(activity.target())).append(',')
                    .append(csv(activity.status())).append(',')
                    .append(csv(activity.note())).append("\r\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String csv(String value) {
        String safe = value == null ? "" : value.replace("\r", " ").replace("\n", " ");
        if (!safe.isEmpty() && "=+-@".indexOf(safe.charAt(0)) >= 0) safe = "'" + safe;
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }

    private boolean isApproved(String status) {
        return List.of("APPROVED", "APPROVE", "FORCE_APPROVE", "RESOLVED", "ACCEPTED_BY_ADMIN")
                .contains(normalize(status));
    }

    private boolean isRejected(String status) {
        return List.of("REJECTED", "REJECT").contains(normalize(status));
    }

    private List<Activity> rank(List<Activity> items, int start) {
        List<Activity> ranked = new ArrayList<>(items.size());
        for (int i = 0; i < items.size(); i++) ranked.add(items.get(i).withSourceRank(start + i));
        return ranked;
    }

    private Mono<SourcePage> fetchPage(SourceRequest source, int page, int size) {
        return source.client().get()
                .uri(builder -> source.uri().apply(builder.queryParam("page", page).queryParam("size", size)).build())
                .headers(headers -> forwardAuth(headers, source.cookie(), source.authorization()))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(json -> {
                    JsonNode content = json.path("content");
                    if (!content.isArray() || !json.path("totalElements").canConvertToLong()) {
                        throw new IllegalStateException("Invalid paginated response from " + source.name());
                    }
                    List<Activity> items = new ArrayList<>();
                    for (JsonNode row : content) {
                        Activity item = source.mapper().apply(row);
                        if (item != null) items.add(item);
                    }
                    return new SourcePage(json.path("totalElements").asLong(), items);
                });
    }

    private void forwardAuth(HttpHeaders headers, String cookie, String authorization) {
        if (StringUtils.hasText(cookie)) headers.set(HttpHeaders.COOKIE, cookie);
        if (StringUtils.hasText(authorization)) headers.set(HttpHeaders.AUTHORIZATION, authorization);
    }

    private List<SourceRequest> sources(Query query, String cookie, String authorization) {
        List<SourceRequest> result = new ArrayList<>();
        String domain = normalize(query.domain());
        boolean pendingOnly = "PENDING".equals(normalize(query.outcome()));
        if (!pendingOnly && matches(domain, "TUTOR_PROFILES")) {
            result.add(new SourceRequest("tutors", account, uri -> common(
                    uri.path("/api/staff/tutor-applications/history"), query, "search", "reviewer")
                    .queryParamIfPresent("status", exactOutcome(query.outcome()).map(String::toUpperCase)), cookie, authorization, this::tutor));
        }
        if (!pendingOnly && matches(domain, "TEACHING_REGISTRATION")) {
            result.add(new SourceRequest("teaching", learning, uri -> common(
                    uri.path("/api/admin/tutor-subject-registrations/history"), query, "search", "reviewer")
                    .queryParamIfPresent("status", exactOutcome(query.outcome()).map(String::toUpperCase)), cookie, authorization, this::teaching));
        }
        if (!pendingOnly && matches(domain, "CLASS_ROOMS")) {
            result.add(new SourceRequest("classes", learning, uri -> {
                UriBuilder builder = common(uri.path("/api/admin/classes"), query, "keyword", "reviewer")
                        .queryParam("reportOnly", true);
                String outcome = normalize(query.outcome());
                if ("APPROVED".equals(outcome)) builder.queryParam("approved", true);
                if ("REJECTED".equals(outcome)) builder.queryParam("status", "REJECTED");
                return builder;
            }, cookie, authorization, this::classroom));
        }
        if (!pendingOnly && matches(domain, "DISPUTES")) {
            result.add(new SourceRequest("disputes", contract, uri -> {
                UriBuilder builder = common(uri.path("/api/contracts/disputes"), query, "keyword", "actor")
                        .queryParam("reportOnly", true);
                String outcome = normalize(query.outcome());
                if ("APPROVED".equals(outcome) || "REJECTED".equals(outcome)) builder.queryParam("status", outcome);
                return builder;
            }, cookie, authorization, this::dispute));
        }
        if (matches(domain, "TERMINATIONS")) {
            result.add(new SourceRequest("terminations", contract, uri -> {
                UriBuilder builder = common(uri.path("/api/contracts/terminations/page"), query, "keyword", "actor")
                        .queryParam("reportOnly", true);
                if (StringUtils.hasText(query.outcome()) && !"ALL".equalsIgnoreCase(query.outcome())) {
                    builder.queryParam("statusGroup", query.outcome());
                }
                return builder;
            }, cookie, authorization, row -> termination(row, query.staff())));
        }
        return result;
    }

    private UriBuilder common(
            UriBuilder builder,
            Query query,
            String searchParameter,
            String staffParameter) {
        if (StringUtils.hasText(query.search())) {
            builder.queryParam(searchParameter, query.search().trim());
        }
        if (StringUtils.hasText(query.staff()) && !"ALL".equalsIgnoreCase(query.staff())) {
            builder.queryParam(staffParameter, query.staff().trim());
        }
        if (StringUtils.hasText(query.from())) builder.queryParam("from", query.from());
        if (StringUtils.hasText(query.to())) builder.queryParam("to", query.to());
        return builder;
    }

    private java.util.Optional<String> exactOutcome(String outcome) {
        String value = normalize(outcome);
        return "APPROVED".equals(value) || "REJECTED".equals(value)
                ? java.util.Optional.of(value)
                : java.util.Optional.empty();
    }

    private boolean matches(String requested, String source) {
        return requested == null || requested.isBlank() || "ALL".equals(requested) || source.equals(requested);
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private Activity tutor(JsonNode row) {
        return activity("tutor-" + first(row, "applicationId", "id"), text(row, "reviewedAt"), text(row, "reviewedByEmail"),
                "TUTOR_PROFILES", "Duyệt hồ sơ & CCCD",
                first(row, "applicantFullName", "fullName", "email"), text(row, "status"),
                first(row, "rejectionReason", "reviewNote"));
    }

    private Activity teaching(JsonNode row) {
        String subject = text(row, "proposedSubjectName");
        if (!StringUtils.hasText(subject)) subject = row.path("subject").path("name").asText(null);
        return activity("teaching-" + text(row, "id"), text(row, "reviewedAt"), text(row, "reviewedByEmail"),
                "TEACHING_REGISTRATION", "Duyệt quyền dạy", subject, text(row, "status"),
                first(row, "reviewNote", "rejectReason"));
    }

    private Activity classroom(JsonNode row) {
        return activity("class-" + text(row, "id"), text(row, "reviewedAt"), text(row, "reviewedByEmail"),
                "CLASS_ROOMS", "Duyệt lớp học", first(row, "name", "className"), text(row, "status"),
                text(row, "rejectReason"));
    }

    private Activity dispute(JsonNode row) {
        String target = first(row, "className");
        String session = text(row, "sessionId");
        if (StringUtils.hasText(session)) target = (target == null ? "Lớp" : target) + " · Buổi #" + session;
        return activity("dispute-" + text(row, "id"), first(row, "resolvedAt", "createdAt"),
                first(row, "resolvedByEmail", "classroomReviewerEmail"), "DISPUTES", "Xử lý khiếu nại",
                target, text(row, "status"), first(row, "resolutionReason", "reason"));
    }

    private Activity termination(JsonNode row, String actorFilter) {
        JsonNode request = row.path("request");
        JsonNode selected = null;
        try {
            JsonNode audit = objectMapper.readTree(request.path("auditJson").asText("[]"));
            if (audit.isArray()) {
                for (JsonNode entry : audit) {
                    String role = text(entry, "role");
                    String actor = text(entry, "actor");
                    if (!("STAFF".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role))) continue;
                    if (StringUtils.hasText(actorFilter) && !"ALL".equalsIgnoreCase(actorFilter)
                            && !actorFilter.equalsIgnoreCase(actor)) continue;
                    if (selected == null || instant(text(entry, "at")).isAfter(instant(text(selected, "at")))) selected = entry;
                }
            }
        } catch (Exception ignored) {
            return null;
        }
        if (selected == null) return null;
        String classId = text(request, "classroomId");
        return activity("termination-" + text(request, "id"), text(selected, "at"), text(selected, "actor"),
                "TERMINATIONS", "Thanh lý / hủy hợp đồng", "Lớp #" + classId,
                first(selected, "action") == null ? text(request, "status") : text(selected, "action"), text(selected, "reason"));
    }

    private Activity activity(String id, String at, String actor, String domain, String type, String target, String status, String note) {
        if (!StringUtils.hasText(at)) return null;
        return new Activity(id, at, actor, domain, type, target, status, note, 0);
    }

    private String first(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (StringUtils.hasText(value)) return value;
        }
        return null;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText(null);
    }

    private static Instant instant(String value) {
        if (!StringUtils.hasText(value)) return Instant.EPOCH;
        try { return Instant.parse(value); } catch (Exception ignored) { }
        try { return OffsetDateTime.parse(value).toInstant(); } catch (Exception ignored) { }
        try { return LocalDateTime.parse(value).toInstant(ZoneOffset.UTC); } catch (Exception ignored) { }
        return Instant.EPOCH;
    }

    static final Comparator<Activity> ACTIVITY_ORDER = Comparator
            .comparing((Activity activity) -> instant(activity.at())).reversed()
            .thenComparing(Activity::domain)
            .thenComparingInt(Activity::sourceRank);

    public record Query(int page, int size, String domain, String outcome, String staff,
                        String search, String from, String to) { }

    public record Activity(String id, String at, String actor, String domain, String type,
                           String target, String status, String note, int sourceRank) {
        Activity withSourceRank(int rank) {
            return new Activity(id, at, actor, domain, type, target, status, note, rank);
        }
    }

    public record ReportPage(List<Activity> content, long totalElements, int totalPages, int number, int size,
                             boolean first, boolean last, boolean empty, Map<String, Long> sourceTotals,
                             List<SourceHealth> sources) {
        static ReportPage empty(int page, int size) {
            return new ReportPage(List.of(), 0, 0, page, size, page == 0, true, true, Map.of(), List.of());
        }
    }

    public record ReportSummary(long total, long approved, long rejected, Double approvalRate,
                                Map<String, Long> sourceTotals, List<StaffPerformance> staffPerformance,
                                List<SourceHealth> sources) { }

    public enum SourceAvailability { SUCCESS, UNAVAILABLE }

    public record SourceHealth(String source, SourceAvailability status, long latencyMs,
                               String lastSuccessfulRefresh, String errorCode) { }

    public record StaffPerformance(String email, long total, long approved, long rejected,
                                   long tutorCount, long classCount, long disputeCount,
                                   long terminationCount, String lastActivityAt) { }

    public static final class ReportLimitExceededException extends RuntimeException {
        ReportLimitExceededException(long actual, int limit) {
            super("Filtered report contains " + actual + " rows; narrow the filters below the " + limit + " row export limit");
        }
    }

    private static final class MutableStaffPerformance {
        private final String email;
        private long total;
        private long approved;
        private long rejected;
        private long tutorCount;
        private long classCount;
        private long disputeCount;
        private long terminationCount;
        private String lastActivityAt;

        private MutableStaffPerformance(String email) { this.email = email; }

        private void accept(Activity activity) {
            total++;
            String status = activity.status() == null ? "" : activity.status().trim().toUpperCase(Locale.ROOT);
            if (List.of("APPROVED", "APPROVE", "FORCE_APPROVE", "RESOLVED", "ACCEPTED_BY_ADMIN").contains(status)) approved++;
            if (List.of("REJECTED", "REJECT").contains(status)) rejected++;
            if ("TUTOR_PROFILES".equals(activity.domain()) || "TEACHING_REGISTRATION".equals(activity.domain())) tutorCount++;
            if ("CLASS_ROOMS".equals(activity.domain())) classCount++;
            if ("DISPUTES".equals(activity.domain())) disputeCount++;
            if ("TERMINATIONS".equals(activity.domain())) terminationCount++;
            if (lastActivityAt == null || instant(activity.at()).isAfter(instant(lastActivityAt))) lastActivityAt = activity.at();
        }

        private StaffPerformance toRecord() {
            return new StaffPerformance(email, total, approved, rejected, tutorCount, classCount,
                    disputeCount, terminationCount, lastActivityAt);
        }
    }

    record SourceRequest(String name, WebClient client, Function<UriBuilder, UriBuilder> uri,
                         String cookie, String authorization, Function<JsonNode, Activity> mapper) { }
    record SourcePage(long totalElements, List<Activity> items) { }
    record SourceSeed(SourceRequest source, SourcePage first, SourceResult failure, long startedNanos) {
        static SourceSeed available(SourceRequest source, SourcePage first, long startedNanos) {
            return new SourceSeed(source, first, null, startedNanos);
        }
        static SourceSeed unavailable(SourceRequest source, SourceResult failure) {
            return new SourceSeed(source, null, failure, 0);
        }
        boolean available() { return first != null; }
    }
    record SourceResult(String name, long totalElements, List<Activity> items, SourceHealth health) {
        SourceResult(String name, long totalElements, List<Activity> items) {
            this(name, totalElements, items,
                    new SourceHealth(name, SourceAvailability.SUCCESS, 0, Instant.now().toString(), null));
        }
        static SourceResult unavailable(String name, SourceHealth health) {
            return new SourceResult(name, 0, List.of(), health);
        }
        SourceResult withHealth(SourceHealth next) { return new SourceResult(name, totalElements, items, next); }
        boolean available() { return health.status() == SourceAvailability.SUCCESS; }
    }
}
