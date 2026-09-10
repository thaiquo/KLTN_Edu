package iuh.fit.learning_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
public class ContractServiceDispatcher {
    private static final Logger log = LoggerFactory.getLogger(ContractServiceDispatcher.class);

    private final HttpClient httpClient;
    private final String contractServiceUrl;
    private final ObjectMapper objectMapper;

    public ContractServiceDispatcher(
            @Value("${CONTRACT_SERVICE_URL:http://localhost:8083}") String contractServiceUrl,
            ObjectMapper objectMapper) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.contractServiceUrl = contractServiceUrl;
        this.objectMapper = objectMapper;
    }

    public record StudentAttendanceOutcomeItem(Long studentId, String outcome) {}

    public void dispatchAutoProposeAsync(Long classroomId, Long sessionId, List<StudentAttendanceOutcomeItem> outcomes) {
        if (classroomId == null || sessionId == null) {
            return;
        }

        try {
            String url = contractServiceUrl + "/api/contracts/internal/classrooms/" + classroomId + "/sessions/" + sessionId + "/auto-propose";
            Map<String, Object> bodyMap = Map.of(
                    "attendances", outcomes != null ? outcomes : List.of()
            );
            String bodyJson = objectMapper.writeValueAsString(bodyMap);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                    .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .thenAccept(res -> {
                        if (res.statusCode() >= 200 && res.statusCode() < 300) {
                            log.info("Successfully dispatched auto-propose to contract-service for classroom #{} session #{}", classroomId, sessionId);
                        } else {
                            log.warn("Contract-service auto-propose call returned status {} for classroom #{} session #{}", res.statusCode(), classroomId, sessionId);
                        }
                    })
                    .exceptionally(ex -> {
                        log.warn("Failed to reach contract-service auto-propose at {}: {}", url, ex.getMessage());
                        return null;
                    });
        } catch (Exception ex) {
            log.warn("Error initiating auto-propose call to contract-service: {}", ex.getMessage());
        }
    }
}
