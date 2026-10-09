package iuh.fit.ai_service.chatbot.service.private_tools;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.util.List;
import java.util.Map;

@Component
public class PrivateLearningClient {
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_OF_MAPS =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    private final RestClient restClient;
    private final String learningServiceUrl;
    private final CallerAuthForwarder authForwarder;

    public PrivateLearningClient(
            RestClient.Builder restClientBuilder,
            @Value("${learning.service.url:http://localhost:8082}") String learningServiceUrl,
            CallerAuthForwarder authForwarder
    ) {
        this.restClient = restClientBuilder.build();
        this.learningServiceUrl = stripTrailingSlash(learningServiceUrl);
        this.authForwarder = authForwarder;
    }

    public List<Map<String, Object>> studentClasses() {
        return getList("/api/student/classes");
    }

    public Map<String, Object> studentSchedule() {
        return getMap("/api/v1/student/schedule");
    }

    public List<Map<String, Object>> studentHomework() {
        return getList("/api/student/homework-overview");
    }

    public List<Map<String, Object>> studentEnrollmentRequests() {
        return getList("/api/v1/enrollment-requests/my-requests");
    }

    public List<Map<String, Object>> tutorClasses() {
        return getList("/api/tutor/classes");
    }

    public List<Map<String, Object>> tutorEnrollmentRequests() {
        return getList("/api/v1/tutor/enrollment-requests");
    }

    public List<Map<String, Object>> tutorHomework() {
        return getList("/api/tutor/homework-overview");
    }

    public List<Map<String, Object>> tutorAvailability() {
        return getList("/api/tutor/availability");
    }

    public List<Map<String, Object>> classSessions(Long classId) {
        return getList("/api/classes/" + classId + "/sessions");
    }

    private List<Map<String, Object>> getList(String path) {
        List<Map<String, Object>> response = get(path, LIST_OF_MAPS);
        return response == null ? List.of() : response;
    }

    private Map<String, Object> getMap(String path) {
        Map<String, Object> response = get(path, MAP);
        return response == null ? Map.of() : response;
    }

    private <T> T get(String path, ParameterizedTypeReference<T> type) {
        try {
            return restClient.get()
                    .uri(URI.create(learningServiceUrl + path))
                    .headers(authForwarder::apply)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        if (response.getStatusCode().value() == 401) {
                            throw new PrivateToolException(PrivateToolException.Reason.UNAUTHORIZED, "Learning authentication expired");
                        }
                        if (response.getStatusCode().value() == 403) {
                            throw new PrivateToolException(PrivateToolException.Reason.FORBIDDEN, "Learning access denied");
                        }
                        throw new PrivateToolException(PrivateToolException.Reason.DOWNSTREAM_UNAVAILABLE, "Learning request failed");
                    })
                    .body(type);
        } catch (PrivateToolException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new PrivateToolException(PrivateToolException.Reason.DOWNSTREAM_UNAVAILABLE, "Learning service unavailable");
        }
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:8082";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
