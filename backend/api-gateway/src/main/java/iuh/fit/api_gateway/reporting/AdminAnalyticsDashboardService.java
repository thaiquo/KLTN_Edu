package iuh.fit.api_gateway.reporting;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class AdminAnalyticsDashboardService {
    private static final List<Integer> ALLOWED_RANGES = List.of(30, 90);

    private final OperationalWorkItemService operational;
    private final WebClient contract;
    private final Duration timeout;

    public AdminAnalyticsDashboardService(
            OperationalWorkItemService operational,
            WebClient.Builder builder,
            @Value("${reporting.sources.contract:${CONTRACT_SERVICE_URL:http://localhost:8083}}") String contractUrl,
            @Value("${admin.analytics.source-timeout:PT10S}") Duration timeout) {
        this.operational = operational;
        this.contract = builder.clone().baseUrl(contractUrl).build();
        this.timeout = timeout;
    }

    public Mono<DashboardResponse> dashboard(String cookie, String authorization, int requestedRangeDays) {
        int rangeDays = normalizeRange(requestedRangeDays);
        Mono<Section> operationalSection = operational.dashboardAnalytics(cookie, authorization)
                .map(data -> Section.success(data, data.partial() ? "PARTIAL" : "SUCCESS"))
                .onErrorResume(error -> Mono.just(Section.unavailable(errorCode(error))));
        Mono<Section> financialSection = contract.get()
                .uri(uri -> uri.path("/api/contracts/admin/financial-trend")
                        .queryParam("rangeDays", rangeDays).build())
                .headers(headers -> forwardAuth(headers, cookie, authorization))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(timeout)
                .map(data -> Section.success(data, "SUCCESS"))
                .onErrorResume(error -> Mono.just(Section.unavailable(errorCode(error))));
        return Mono.zip(operationalSection, financialSection)
                .map(tuple -> new DashboardResponse(Instant.now().toString(), rangeDays,
                        tuple.getT1(), tuple.getT2()));
    }

    private int normalizeRange(int rangeDays) {
        if (!ALLOWED_RANGES.contains(rangeDays)) {
            throw new IllegalArgumentException("rangeDays must be 30 or 90");
        }
        return rangeDays;
    }

    private void forwardAuth(HttpHeaders headers, String cookie, String authorization) {
        if (StringUtils.hasText(cookie)) headers.set(HttpHeaders.COOKIE, cookie);
        if (StringUtils.hasText(authorization)) headers.set(HttpHeaders.AUTHORIZATION, authorization);
    }

    private String errorCode(Throwable error) {
        if (error instanceof WebClientResponseException response) {
            return "HTTP_" + response.getStatusCode().value();
        }
        if (error instanceof java.util.concurrent.TimeoutException) return "TIMEOUT";
        return error.getClass().getSimpleName().toUpperCase(Locale.ROOT);
    }

    public record DashboardResponse(String generatedAt, int rangeDays, Section operational, Section financial) { }

    public record Section(String status, String errorCode, Object data) {
        static Section success(Object data, String status) { return new Section(status, null, data); }
        static Section unavailable(String errorCode) { return new Section("UNAVAILABLE", errorCode, null); }
    }
}
