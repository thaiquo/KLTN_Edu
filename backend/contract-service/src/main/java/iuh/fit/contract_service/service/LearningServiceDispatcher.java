package iuh.fit.contract_service.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class LearningServiceDispatcher {
    private static final Logger log = LoggerFactory.getLogger(LearningServiceDispatcher.class);

    private final HttpClient httpClient;
    private final String learningServiceUrl;

    public LearningServiceDispatcher(
            @Value("${LEARNING_SERVICE_URL:http://localhost:8082}") String learningServiceUrl) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.learningServiceUrl = learningServiceUrl;
    }

    public void activateEnrollmentAsync(Long classroomId, Long studentId, String agreementId) {
        dispatchInternalAsync("/api/learning/internal/enrollment-requests/activate", classroomId, studentId, agreementId);
    }

    public void expireEnrollmentAsync(Long classroomId, Long studentId, String agreementId) {
        dispatchInternalAsync("/api/learning/internal/enrollment-requests/expire", classroomId, studentId, agreementId);
    }

    private void dispatchInternalAsync(String endpoint, Long classroomId, Long studentId, String agreementId) {
        try {
            String url = learningServiceUrl + endpoint;
            String bodyJson = String.format(
                    "{\"classRoomId\":%s,\"studentId\":%s,\"agreementId\":%s}",
                    classroomId != null ? classroomId : "null",
                    studentId != null ? studentId : "null",
                    agreementId != null ? "\"" + agreementId + "\"" : "null"
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(4))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                    .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .thenAccept(res -> {
                        if (res.statusCode() >= 200 && res.statusCode() < 300) {
                            log.info("Successfully dispatched to learning-service {} for agreement {}", endpoint, agreementId);
                        } else {
                            log.warn("Learning-service call to {} returned status {}", endpoint, res.statusCode());
                        }
                    })
                    .exceptionally(ex -> {
                        log.warn("Failed to reach learning-service at {}: {}", url, ex.getMessage());
                        return null;
                    });
        } catch (Exception ex) {
            log.warn("Error initiating call to learning-service {}: {}", endpoint, ex.getMessage());
        }
    }
}
