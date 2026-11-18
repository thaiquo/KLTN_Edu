package iuh.fit.api_gateway.reporting;

import tools.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class TutorStatisticsService {
    private final WebClient learning;
    private final WebClient contract;
    private final Duration timeout;

    public TutorStatisticsService(
            WebClient.Builder builder,
            @Value("${tutor.statistics.learning-url:http://localhost:8082}") String learningUrl,
            @Value("${tutor.statistics.contract-url:http://localhost:8083}") String contractUrl,
            @Value("${tutor.statistics.sources.timeout:PT5S}") Duration timeout
    ) {
        this.learning = builder.clone().baseUrl(learningUrl).build();
        this.contract = builder.clone().baseUrl(contractUrl).build();
        this.timeout = timeout;
    }

    public Mono<TutorStatisticsResponse> aggregate(String cookie, String authorization, int requestedRangeDays) {
        int rangeDays = requestedRangeDays == 7 || requestedRangeDays == 90 ? requestedRangeDays : 30;
        Mono<SourceSection> learningSource = source(
                learning, "/api/tutor/statistics/source?rangeDays=" + rangeDays, cookie, authorization, "LEARNING");
        Mono<SourceSection> contractSource = source(
                contract, "/api/contracts/tutor/statistics/source?rangeDays=" + rangeDays, cookie, authorization, "CONTRACT");
        return Mono.zip(learningSource, contractSource)
                .map(tuple -> new TutorStatisticsResponse(
                        Instant.now().toString(), rangeDays,
                        tuple.getT1(), tuple.getT2(), List.of(tuple.getT1().health(), tuple.getT2().health())
                ));
    }

    private Mono<SourceSection> source(
            WebClient client,
            String path,
            String cookie,
            String authorization,
            String source
    ) {
        return client.get().uri(path)
                .headers(headers -> forward(headers, cookie, authorization))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(timeout)
                .map(data -> new SourceSection("SUCCESS", data, null,
                        new SourceHealth(source, "SUCCESS", null)))
                .onErrorResume(error -> Mono.just(new SourceSection(
                        "UNAVAILABLE", null, errorCode(error),
                        new SourceHealth(source, "UNAVAILABLE", errorCode(error))
                )));
    }

    private void forward(HttpHeaders headers, String cookie, String authorization) {
        if (StringUtils.hasText(cookie)) headers.set(HttpHeaders.COOKIE, cookie);
        if (StringUtils.hasText(authorization)) headers.set(HttpHeaders.AUTHORIZATION, authorization);
    }

    private String errorCode(Throwable error) {
        if (error instanceof java.util.concurrent.TimeoutException) return "TIMEOUT";
        if (error instanceof org.springframework.web.reactive.function.client.WebClientResponseException response) {
            return "HTTP_" + response.getStatusCode().value();
        }
        return "SOURCE_UNAVAILABLE";
    }

    public record TutorStatisticsResponse(
            String generatedAt,
            int rangeDays,
            SourceSection learning,
            SourceSection income,
            List<SourceHealth> sources
    ) { }

    public record SourceSection(String status, JsonNode data, String errorCode, SourceHealth health) { }

    public record SourceHealth(String source, String status, String errorCode) { }
}
