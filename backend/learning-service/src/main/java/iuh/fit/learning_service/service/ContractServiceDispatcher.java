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
    private final javax.crypto.SecretKey serviceKey;

    public ContractServiceDispatcher(
            @Value("${CONTRACT_SERVICE_URL:http://localhost:8083}") String contractServiceUrl,
            @Value("${jwt.secret}") String jwtSecret) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.contractServiceUrl = contractServiceUrl;
        this.objectMapper = new ObjectMapper();
        this.serviceKey = io.jsonwebtoken.security.Keys.hmacShaKeyFor(jwtSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public record StudentAttendanceOutcomeItem(Long studentId, String outcome) {}

    public boolean dispatchAutoPropose(Long classroomId, Long sessionId, List<StudentAttendanceOutcomeItem> outcomes) {
        if (classroomId == null || sessionId == null) {
            return false;
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
                    .header("X-Service-Token", io.jsonwebtoken.Jwts.builder()
                            .subject("learning-service").claim("serviceScope", "contract-settlement")
                            .expiration(java.util.Date.from(java.time.Instant.now().plusSeconds(60)))
                            .signWith(serviceKey).compact())
                    .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) return false;
            var proposals = objectMapper.readTree(response.body()).get("proposals");
            if (proposals == null || !proposals.isArray()) return false;
            for (var proposal : proposals) {
                if (proposal.has("error")) return false;
            }
            return true;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception ex) {
            log.warn("Error initiating auto-propose call to contract-service: {}", ex.getMessage());
            return false;
        }
    }
}
