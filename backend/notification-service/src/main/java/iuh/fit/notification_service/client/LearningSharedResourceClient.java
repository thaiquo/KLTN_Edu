package iuh.fit.notification_service.client;

import iuh.fit.notification_service.entity.SharedResourceType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.UUID;

@Component
public class LearningSharedResourceClient {
    private final RestClient restClient;
    private final String learningServiceUrl;

    public LearningSharedResourceClient(
            RestClient.Builder restClientBuilder,
            @Value("${learning.service.url:http://localhost:8082}") String learningServiceUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.learningServiceUrl = stripTrailingSlash(learningServiceUrl);
    }

    public void requireAvailable(SharedResourceType type, UUID publicShareId) {
        String path = type == SharedResourceType.CLASS
                ? "/api/public/classes/shared/{publicShareId}"
                : "/api/community/posts/shared/{publicShareId}";
        URI uri = UriComponentsBuilder.fromUriString(learningServiceUrl)
                .path(path)
                .build(publicShareId);
        try {
            restClient.get().uri(uri).retrieve().toBodilessEntity();
        } catch (HttpClientErrorException.NotFound ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Tài nguyên không tồn tại hoặc không còn công khai", ex);
        } catch (HttpClientErrorException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể chia sẻ tài nguyên này", ex);
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Dịch vụ kiểm tra tài nguyên tạm thời không khả dụng", ex);
        }
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) return "http://localhost:8082";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
