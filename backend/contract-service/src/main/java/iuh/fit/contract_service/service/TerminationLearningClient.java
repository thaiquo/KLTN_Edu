package iuh.fit.contract_service.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

@Component
public class TerminationLearningClient {
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final String url;
    private final SecretKey key;
    private final ObjectMapper mapper;
    public record Snapshot(int cutoffSession, List<Long> requiredSessions, OffsetDateTime nextSessionStart) {}
    public TerminationLearningClient(@Value("${LEARNING_SERVICE_URL:http://localhost:8082}") String url,
                                    @Value("${jwt.secret}") String secret, ObjectMapper mapper) {
        this.url = url;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.mapper = mapper;
    }
    public Snapshot send(Long classroomId, Long studentId, UUID agreementId, boolean wholeClass, String action) {
        return send(classroomId, studentId, agreementId, wholeClass, action, null, null, null, null);
    }
    public Snapshot send(Long classroomId, Long studentId, UUID agreementId, boolean wholeClass, String action,
                         String origin, Integer requestedCutoffSession, OffsetDateTime effectiveRequestedAt,
                         UUID commandId) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("classroomId", classroomId);
            payload.put("studentId", studentId);
            payload.put("agreementId", agreementId.toString());
            payload.put("wholeClass", wholeClass);
            payload.put("action", action);
            if (origin != null) payload.put("origin", origin);
            if (requestedCutoffSession != null) payload.put("requestedCutoffSession", requestedCutoffSession);
            if (effectiveRequestedAt != null) payload.put("effectiveRequestedAt", effectiveRequestedAt);
            if (commandId != null) payload.put("commandId", commandId);
            String body = mapper.writeValueAsString(payload);
            String token = Jwts.builder().subject("contract-service").claim("serviceScope", "learning-termination")
                    .expiration(Date.from(Instant.now().plusSeconds(60))).signWith(key).compact();
            var request = HttpRequest.newBuilder(URI.create(url + "/api/learning/internal/termination"))
                    .timeout(Duration.ofSeconds(5)).header("Content-Type", "application/json")
                    .header("X-Service-Token", token).POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                String detail = response.statusCode() == 409 ? mapper.readTree(response.body()).path("error").asText() : "";
                throw new IllegalStateException("Learning termination returned HTTP " + response.statusCode() + " " + detail);
            }
            return mapper.readValue(response.body(), Snapshot.class);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Learning termination interrupted", e);
        } catch (Exception e) {
            throw new IllegalStateException("Learning synchronization pending: " + e.getMessage(), e);
        }
    }
}
