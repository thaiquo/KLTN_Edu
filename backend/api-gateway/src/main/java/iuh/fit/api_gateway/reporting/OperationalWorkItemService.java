package iuh.fit.api_gateway.reporting;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriBuilder;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Date;
import java.util.function.Function;

@Service
public class OperationalWorkItemService {
    public static final String CONTRACT_VERSION = "V1";
    static final int SOURCE_PAGE_SIZE = 50;
    static final int MAX_PAGE = 1_000;

    private final WebClient account;
    private final WebClient learning;
    private final WebClient contract;
    private final OperationalSlaPolicy slaPolicy;
    private final OperationalSourceHealthRegistry healthRegistry;
    private final SecretKey serviceTokenKey;
    private final Duration sourceTimeout;
    private final long degradedThresholdMs;

    @Autowired
    public OperationalWorkItemService(
            OperationalSlaPolicy slaPolicy,
            @Value("${reporting.sources.account:${ACCOUNT_SERVICE_URL:http://localhost:8081}}") String accountUrl,
            @Value("${reporting.sources.learning:${LEARNING_SERVICE_URL:http://localhost:8082}}") String learningUrl,
            @Value("${reporting.sources.contract:${CONTRACT_SERVICE_URL:http://localhost:8083}}") String contractUrl,
            @Value("${jwt.secret}") String jwtSecret,
            @Value("${operations.sources.timeout:PT5S}") Duration sourceTimeout,
            @Value("${operations.sources.degraded-threshold:PT2S}") Duration degradedThreshold,
            OperationalSourceHealthRegistry healthRegistry) {
        WebClient.Builder builder = WebClient.builder();
        this.account = builder.clone().baseUrl(accountUrl).build();
        this.learning = builder.clone().baseUrl(learningUrl).build();
        this.contract = builder.clone().baseUrl(contractUrl).build();
        this.slaPolicy = slaPolicy;
        this.healthRegistry = healthRegistry;
        this.serviceTokenKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        this.sourceTimeout = sourceTimeout;
        this.degradedThresholdMs = degradedThreshold.toMillis();
    }

    OperationalWorkItemService(OperationalSlaPolicy slaPolicy, String accountUrl, String learningUrl,
                               String contractUrl) {
        this(slaPolicy, accountUrl, learningUrl, contractUrl,
                "test-secret-key-that-is-at-least-thirty-two-bytes-long", Duration.ofSeconds(5),
                Duration.ofSeconds(2), new OperationalSourceHealthRegistry());
    }

    public Mono<WorkItemPage> page(int page, int size, String cookie, String authorization) {
        if (page < 0 || page > MAX_PAGE || size < 1 || size > 50) {
            return Mono.error(new IllegalArgumentException("page must be between 0 and 1000 and size between 1 and 50"));
        }
        int required = Math.multiplyExact(page + 1, size);
        List<SourceRequest> sources = browserSources(cookie, authorization);
        return Flux.fromIterable(sources)
                .flatMap(source -> fetchSafe(source, required), sources.size())
                .collectList()
                .map(results -> merge(results, page, size));
    }

    public Mono<SlaSummary> slaSummary(String cookie, String authorization) {
        List<SourceRequest> sources = browserSources(cookie, authorization);
        return Flux.fromIterable(sources)
                .flatMap(source -> fetchSafe(source, 1_000), sources.size())
                .collectList()
                .map(this::summarizeSla);
    }

    public Mono<OperationalAnalytics> dashboardAnalytics(String cookie, String authorization) {
        List<SourceRequest> sources = browserSources(cookie, authorization);
        return Flux.fromIterable(sources)
                .flatMap(source -> fetchSafe(source, 1_000), sources.size())
                .collectList()
                .map(this::toOperationalAnalytics);
    }

    public Mono<SchedulerBatch> schedulerBatch() {
        List<SourceRequest> sources = schedulerSources(serviceToken());
        return Flux.fromIterable(sources)
                .flatMap(source -> fetchSafe(source, 1_000), sources.size())
                .collectList()
                .map(results -> new SchedulerBatch(
                        results.stream().flatMap(result -> result.items().stream()).toList(),
                        results.stream().map(SourceResult::health).toList()));
    }

    private SlaSummary summarizeSla(List<SourceResult> results) {
        long normal = 0;
        long dueSoon = 0;
        long overdue = 0;
        long notApplicable = 0;
        boolean truncated = false;
        Map<String, SlaSourceSummary> bySource = new LinkedHashMap<>();
        for (SourceResult result : results) {
            if (!result.available()) {
                bySource.put(result.source(), new SlaSourceSummary(result.source(), null, null, null, null,
                        false, result.health().status(), result.health().errorCode()));
                continue;
            }
            long sourceNormal = count(result.items(), OperationalSlaPolicy.SlaState.NORMAL);
            long sourceDueSoon = count(result.items(), OperationalSlaPolicy.SlaState.DUE_SOON);
            long sourceOverdue = count(result.items(), OperationalSlaPolicy.SlaState.OVERDUE);
            long sourceNotApplicable = count(result.items(), OperationalSlaPolicy.SlaState.NOT_APPLICABLE);
            boolean sourceTruncated = result.totalElements() > result.items().size();
            normal += sourceNormal;
            dueSoon += sourceDueSoon;
            overdue += sourceOverdue;
            notApplicable += sourceNotApplicable;
            truncated |= sourceTruncated;
            bySource.put(result.source(), new SlaSourceSummary(result.source(), sourceNormal, sourceDueSoon,
                    sourceOverdue, sourceNotApplicable, sourceTruncated, result.health().status(), null));
        }
        return new SlaSummary(normal, dueSoon, overdue, notApplicable, truncated, bySource,
                results.stream().map(SourceResult::health).toList());
    }

    private OperationalAnalytics toOperationalAnalytics(List<SourceResult> results) {
        SlaSummary sla = summarizeSla(results);
        List<WorkItemSourceCount> bySource = results.stream()
                .map(result -> new WorkItemSourceCount(result.source(),
                        result.available() ? result.totalElements() : null,
                        result.health().status(), result.health().errorCode()))
                .toList();
        Map<String, MutableWorkload> workloads = new LinkedHashMap<>();
        results.stream().filter(SourceResult::available)
                .flatMap(result -> result.items().stream())
                .filter(item -> StringUtils.hasText(item.assignee()))
                .forEach(item -> workloads.computeIfAbsent(item.assignee().trim(), MutableWorkload::new).accept(item));
        List<StaffWorkload> staff = workloads.values().stream()
                .map(MutableWorkload::toResponse)
                .sorted(Comparator.comparingLong(StaffWorkload::overdue).reversed()
                        .thenComparing(Comparator.comparingLong(StaffWorkload::dueSoon).reversed())
                        .thenComparing(Comparator.comparingLong(StaffWorkload::assigned).reversed())
                        .thenComparing(StaffWorkload::assignee))
                .toList();
        boolean partial = results.stream().anyMatch(result -> !result.available());
        List<String> unavailable = results.stream().filter(result -> !result.available())
                .map(SourceResult::source).toList();
        return new OperationalAnalytics(CONTRACT_VERSION, bySource, sla, staff, partial,
                sla.truncated(), unavailable, results.stream().map(SourceResult::health).toList());
    }

    private long count(List<WorkItemV1> items, OperationalSlaPolicy.SlaState state) {
        return items.stream().filter(item -> item.slaState() == state).count();
    }

    WorkItemPage merge(List<SourceResult> results, int page, int size) {
        List<WorkItemV1> all = results.stream()
                .flatMap(result -> result.items().stream())
                .sorted(WORK_ITEM_ORDER)
                .toList();
        int from = Math.min(page * size, all.size());
        int to = Math.min(from + size, all.size());
        long total = results.stream().filter(SourceResult::available).mapToLong(SourceResult::totalElements).sum();
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / size);
        Map<String, Long> totals = new LinkedHashMap<>();
        results.forEach(result -> totals.put(result.source(), result.available() ? result.totalElements() : null));
        return new WorkItemPage(CONTRACT_VERSION, all.subList(from, to), total, totalPages, page, size,
                page == 0, page + 1 >= totalPages, from == to, totals,
                results.stream().map(SourceResult::health).toList());
    }

    private Mono<SourceResult> fetchSafe(SourceRequest source, int required) {
        long started = System.nanoTime();
        return fetch(source, required)
                .map(result -> result.withHealth(healthRegistry.success(source.name(), elapsed(started),
                        result.totalElements(), degradedThresholdMs)))
                .onErrorResume(error -> authorizationFailure(error)
                        ? Mono.error(error)
                        : Mono.just(SourceResult.unavailable(source.name(), unavailable(source.name(), started, error))));
    }

    private Mono<SourceResult> fetch(SourceRequest source, int required) {
        int chunk = Math.min(SOURCE_PAGE_SIZE, required);
        return fetchPage(source, 0, chunk).flatMap(first -> {
            int available = (int) Math.min(first.totalElements(), required);
            int pageCount = available == 0 ? 0 : (int) Math.ceil((double) available / chunk);
            if (pageCount <= 1) return Mono.just(new SourceResult(source.name(), first.totalElements(), first.items(), null));
            return Flux.range(1, pageCount - 1)
                    .concatMap(index -> fetchPage(source, index, chunk))
                    .map(SourcePage::items)
                    .startWith(first.items())
                    .collectList()
                    .map(pages -> new SourceResult(source.name(), first.totalElements(),
                            pages.stream().flatMap(List::stream).limit(required).toList(), null));
        });
    }

    private Mono<SourcePage> fetchPage(SourceRequest source, int page, int size) {
        return source.client().get()
                .uri(builder -> source.uri().apply(builder.queryParam("page", page).queryParam("size", size)).build())
                .headers(headers -> forwardAuth(headers, source.cookie(), source.authorization()))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(sourceTimeout)
                .map(json -> {
                    JsonNode content = json.path("content");
                    if (!content.isArray() || !json.path("totalElements").canConvertToLong()) {
                        throw new IllegalStateException("Invalid paginated response from " + source.name());
                    }
                    List<WorkItemV1> items = new ArrayList<>();
                    for (JsonNode row : content) {
                        WorkItemV1 item = source.mapper().apply(row);
                        if (item != null) items.add(item);
                    }
                    return new SourcePage(json.path("totalElements").asLong(), items);
                });
    }

    private void forwardAuth(HttpHeaders headers, String cookie, String authorization) {
        if (StringUtils.hasText(cookie)) headers.set(HttpHeaders.COOKIE, cookie);
        if (StringUtils.hasText(authorization)) headers.set(HttpHeaders.AUTHORIZATION, authorization);
        if (StringUtils.hasText(authorization) && authorization.startsWith("Service ")) {
            headers.remove(HttpHeaders.AUTHORIZATION);
            headers.set("X-Service-Token", authorization.substring("Service ".length()));
        }
    }

    private boolean authorizationFailure(Throwable error) {
        return error instanceof WebClientResponseException response
                && (response.getStatusCode().value() == 401 || response.getStatusCode().value() == 403);
    }

    private SourceHealth unavailable(String source, long started, Throwable error) {
        String code;
        String summary;
        if (error instanceof java.util.concurrent.TimeoutException) {
            code = "TIMEOUT";
            summary = "Source did not respond within the configured timeout";
        } else if (error instanceof WebClientResponseException response) {
            code = "HTTP_" + response.getStatusCode().value();
            summary = response.getStatusCode().is5xxServerError()
                    ? "Source returned a server error" : "Source request was rejected";
        } else if (error instanceof IllegalStateException) {
            code = "INVALID_RESPONSE";
            summary = "Source returned an invalid response";
        } else {
            code = error.getClass().getSimpleName().toUpperCase(Locale.ROOT);
            summary = "Source is temporarily unavailable";
        }
        return healthRegistry.unavailable(source, elapsed(started), code, summary);
    }

    private long elapsed(long started) {
        return Math.max(0, (System.nanoTime() - started) / 1_000_000L);
    }

    private List<SourceRequest> browserSources(String cookie, String authorization) {
        return List.of(
                new SourceRequest("TUTOR_APPLICATION", account,
                        uri -> uri.path("/api/staff/tutor-applications/pending"), cookie, authorization, this::tutor),
                new SourceRequest("TEACHING_REGISTRATION", learning,
                        uri -> uri.path("/api/admin/tutor-subject-registrations").queryParam("proposalsOnly", false),
                        cookie, authorization, this::teaching),
                new SourceRequest("CLASS_APPROVAL", learning,
                        uri -> uri.path("/api/admin/classes").queryParam("status", "PENDING_APPROVAL"),
                        cookie, authorization, this::classroom),
                new SourceRequest("DISPUTE", contract,
                        uri -> uri.path("/api/contracts/disputes").queryParam("statusGroup", "PENDING"),
                        cookie, authorization, this::dispute),
                new SourceRequest("TERMINATION", contract,
                        uri -> uri.path("/api/contracts/terminations/page").queryParam("statusGroup", "PENDING"),
                        cookie, authorization, this::termination),
                new SourceRequest("COMMUNITY_MODERATION", learning,
                        uri -> uri.path("/api/community/moderation/queue"), cookie, authorization, this::community),
                new SourceRequest("SUPPORT_TICKET", account,
                        uri -> uri.path("/api/support/tickets"), cookie, authorization, this::support)
        );
    }

    private List<SourceRequest> schedulerSources(String token) {
        String auth = "Service " + token;
        return List.of(
                new SourceRequest("TUTOR_APPLICATION", account,
                        uri -> uri.path("/api/staff/tutor-applications/pending"), null, auth, this::tutor),
                new SourceRequest("TEACHING_REGISTRATION", learning,
                        uri -> uri.path("/api/admin/tutor-subject-registrations").queryParam("proposalsOnly", false),
                        null, auth, this::teaching),
                new SourceRequest("CLASS_APPROVAL", learning,
                        uri -> uri.path("/api/admin/classes").queryParam("status", "PENDING_APPROVAL"),
                        null, auth, this::classroom),
                new SourceRequest("DISPUTE", contract,
                        uri -> uri.path("/api/contracts/disputes").queryParam("statusGroup", "PENDING"),
                        null, auth, this::dispute),
                new SourceRequest("TERMINATION", contract,
                        uri -> uri.path("/api/contracts/terminations/page").queryParam("statusGroup", "PENDING"),
                        null, auth, this::termination),
                new SourceRequest("COMMUNITY_MODERATION", learning,
                        uri -> uri.path("/api/community/moderation/queue"), null, auth, this::community),
                new SourceRequest("SUPPORT_TICKET", account,
                        uri -> uri.path("/api/internal/operational-work-items/support-tickets"),
                        null, auth, this::support)
        );
    }

    private String serviceToken() {
        return Jwts.builder()
                .subject("api-gateway")
                .claim("serviceScope", "operational-read")
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(serviceTokenKey)
                .compact();
    }

    private WorkItemV1 tutor(JsonNode row) {
        return item("TUTOR_APPLICATION", first(row, "applicationId", "id"), row,
                first(row, "applicantFullName", "fullName", "email"), text(row, "status"), Priority.NORMAL,
                null, first(row, "createdAt", "submittedAt"), null, "?tab=tutor-approval&subtab=TUTOR_PROFILES", false);
    }

    private WorkItemV1 teaching(JsonNode row) {
        String title = text(row, "proposedSubjectName");
        if (!StringUtils.hasText(title)) title = row.path("subject").path("name").asText("Môn dạy");
        return item("TEACHING_REGISTRATION", text(row, "id"), row, title, text(row, "status"), Priority.NORMAL,
                null, first(row, "createdAt", "submittedAt"), null,
                "?tab=tutor-approval&subtab=TEACHING_REGISTRATION", false);
    }

    private WorkItemV1 classroom(JsonNode row) {
        return item("CLASS_APPROVAL", text(row, "id"), row, first(row, "name", "className"), text(row, "status"),
                Priority.MEDIUM, null, text(row, "createdAt"), null, "?tab=class-management", false);
    }

    private WorkItemV1 dispute(JsonNode row) {
        Priority priority = row.path("readyForResolution").asBoolean(false) ? Priority.HIGH
                : StringUtils.hasText(text(row, "tutorResponseDeadline")) ? Priority.MEDIUM : Priority.NORMAL;
        return item("DISPUTE", text(row, "id"), row, first(row, "className", "reason"), text(row, "status"),
                priority, text(row, "classroomReviewerEmail"), text(row, "createdAt"),
                text(row, "tutorResponseDeadline"), "?tab=complaints", false);
    }

    private WorkItemV1 termination(JsonNode row) {
        JsonNode request = row.path("request").isMissingNode() ? row : row.path("request");
        return item("TERMINATION", text(request, "id"), request,
                "Lớp #" + first(request, "classroomId", "anchorAgreementId"), text(request, "status"), Priority.HIGH,
                first(request, "reviewerEmail", "assignedStaffEmail"), text(request, "createdAt"),
                text(request, "responseDeadline"), "?tab=contracts", false);
    }

    private WorkItemV1 community(JsonNode row) {
        return item("COMMUNITY_MODERATION", text(row, "postId"), row, text(row, "title"),
                text(row, "moderationStatus"), row.path("openReportCount").asLong(0) > 0 ? Priority.HIGH : Priority.MEDIUM,
                null, text(row, "createdAt"), null, "?tab=community-moderation", false);
    }

    private WorkItemV1 support(JsonNode row) {
        String status = text(row, "status");
        if (List.of("RESOLVED", "CLOSED").contains(normalize(status))) return null;
        boolean claimable = row.path("assigneeId").isNull() || row.path("assigneeId").isMissingNode();
        return item("SUPPORT_TICKET", text(row, "id"), row, text(row, "subject"), status,
                "ESCALATED".equals(normalize(status)) ? Priority.HIGH : Priority.NORMAL,
                text(row, "assigneeName"), text(row, "createdAt"), null, "?tab=help", claimable);
    }

    private WorkItemV1 item(String source, String resourceId, JsonNode row, String title, String status,
                            Priority priority, String assignee, String createdAt, String dueAt,
                            String actionUrl, boolean claimable) {
        if (!StringUtils.hasText(resourceId)) return null;
        String revision = first(row, "version", "contentRevision", "revisionId");
        if (!StringUtils.hasText(revision)) {
            String transitionAt = first(row, "updatedAt", "reviewedAt", "createdAt", "submittedAt");
            revision = normalize(status) + ":" + (StringUtils.hasText(transitionAt) ? transitionAt : "UNVERSIONED");
        }
        Instant created = instant(createdAt);
        Instant businessDue = instant(dueAt);
        Long age = created == null ? null : Math.max(0, Duration.between(created, Instant.now()).toSeconds());
        OperationalSlaPolicy.Evaluation sla = slaPolicy.evaluate(source, status, created, businessDue);
        return new WorkItemV1(source, resourceId, revision, title, status, priority, assignee, createdAt,
                age, sla.dueAt() == null ? null : sla.dueAt().toString(), actionUrl, claimable, SourceStatus.SUCCESS,
                sla.state(), sla.remainingMinutes(), sla.overdueByMinutes(), sla.policyId(), sla.paused(), sla.pauseReason());
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

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private Instant instant(String value) {
        if (!StringUtils.hasText(value)) return null;
        try { return Instant.parse(value); } catch (Exception ignored) { }
        try { return OffsetDateTime.parse(value).toInstant(); } catch (Exception ignored) { }
        try { return LocalDateTime.parse(value).atZone(slaPolicy.sourceZone()).toInstant(); } catch (Exception ignored) { }
        return null;
    }

    static final Comparator<WorkItemV1> WORK_ITEM_ORDER = Comparator
            .comparingInt((WorkItemV1 item) -> slaWeight(item.slaState())).reversed()
            .thenComparing(Comparator.comparingInt((WorkItemV1 item) -> item.priority().weight()).reversed())
            .thenComparing(WorkItemV1::createdAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(WorkItemV1::source)
            .thenComparing(WorkItemV1::resourceId);

    private static int slaWeight(OperationalSlaPolicy.SlaState state) {
        return switch (state) {
            case OVERDUE -> 4;
            case DUE_SOON -> 3;
            case NORMAL -> 2;
            case NOT_APPLICABLE -> 1;
        };
    }

    public enum Priority {
        HIGH(3), MEDIUM(2), NORMAL(1);
        private final int weight;
        Priority(int weight) { this.weight = weight; }
        int weight() { return weight; }
    }

    public enum SourceStatus { SUCCESS, DEGRADED, UNAVAILABLE }

    public record WorkItemV1(String source, String resourceId, String workflowRevision, String title,
                             String status, Priority priority, String assignee, String createdAt, Long age,
                             String dueAt, String actionUrl, boolean claimable, SourceStatus sourceStatus,
                             OperationalSlaPolicy.SlaState slaState, Long remainingMinutes, Long overdueByMinutes,
                             String slaPolicyId, boolean slaPaused, String slaPauseReason) { }

    public record SourceHealth(String source, SourceStatus status, long latencyMs,
                               String lastSuccessfulRefresh, String errorCode, String errorSummary,
                               Long itemCount, String checkedAt) { }

    public record WorkItemPage(String contractVersion, List<WorkItemV1> content, long totalElements,
                               int totalPages, int number, int size, boolean first, boolean last, boolean empty,
                               Map<String, Long> sourceTotals, List<SourceHealth> sources) { }

    public record SlaSourceSummary(String source, Long normal, Long dueSoon, Long overdue, Long notApplicable,
                                   boolean truncated, SourceStatus sourceStatus, String errorCode) { }

    public record SlaSummary(long normal, long dueSoon, long overdue, long notApplicable, boolean truncated,
                             Map<String, SlaSourceSummary> bySource, List<SourceHealth> sources) { }

    public record WorkItemSourceCount(String source, Long openCount, SourceStatus status, String errorCode) { }

    public record StaffWorkload(String assignee, long assigned, long normal, long dueSoon, long overdue,
                                long notApplicable) { }

    public record OperationalAnalytics(String contractVersion, List<WorkItemSourceCount> workItemsBySource,
                                       SlaSummary sla, List<StaffWorkload> staffWorkload, boolean partial,
                                       boolean truncated, List<String> unavailableSources,
                                       List<SourceHealth> sources) { }

    public record SchedulerBatch(List<WorkItemV1> items, List<SourceHealth> sources) { }

    record SourceRequest(String name, WebClient client, Function<UriBuilder, UriBuilder> uri,
                         String cookie, String authorization, Function<JsonNode, WorkItemV1> mapper) { }
    record SourcePage(long totalElements, List<WorkItemV1> items) { }
    record SourceResult(String source, long totalElements, List<WorkItemV1> items, SourceHealth health) {
        static SourceResult unavailable(String source, SourceHealth health) {
            return new SourceResult(source, 0, List.of(), health);
        }
        SourceResult withHealth(SourceHealth next) { return new SourceResult(source, totalElements, items, next); }
        boolean available() { return health != null && health.status() != SourceStatus.UNAVAILABLE; }
    }

    private static final class MutableWorkload {
        private final String assignee;
        private long normal;
        private long dueSoon;
        private long overdue;
        private long notApplicable;

        private MutableWorkload(String assignee) { this.assignee = assignee; }

        private void accept(WorkItemV1 item) {
            switch (item.slaState()) {
                case NORMAL -> normal++;
                case DUE_SOON -> dueSoon++;
                case OVERDUE -> overdue++;
                case NOT_APPLICABLE -> notApplicable++;
            }
        }

        private StaffWorkload toResponse() {
            return new StaffWorkload(assignee, normal + dueSoon + overdue + notApplicable,
                    normal, dueSoon, overdue, notApplicable);
        }
    }
}
