package iuh.fit.ai_service.client;

import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSemanticSourceResponse;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSource;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;

@Component
public class LearningPublicClassClient {
    private static final int DEFAULT_MAX = 500;

    private final RestClient restClient;
    private final String learningServiceUrl;

    public LearningPublicClassClient(
            RestClient.Builder restClientBuilder,
            @Value("${learning.service.url:http://localhost:8082}") String learningServiceUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.learningServiceUrl = stripTrailingSlash(learningServiceUrl);
    }

    public List<PublicClassSource> findSemanticSources(
            List<Long> ids,
            Long subjectId,
            Long levelId,
            TeachingMode teachingMode,
            boolean availableOnly,
            Integer max
    ) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(learningServiceUrl)
                .path("/api/public/classes/semantic-source")
                .queryParam("availableOnly", availableOnly)
                .queryParam("max", max == null || max <= 0 ? DEFAULT_MAX : max);
        if (ids != null && !ids.isEmpty()) {
            builder.queryParam("ids", ids.toArray());
        }
        if (subjectId != null) {
            builder.queryParam("subjectId", subjectId);
        }
        if (levelId != null) {
            builder.queryParam("levelId", levelId);
        }
        if (teachingMode != null) {
            builder.queryParam("teachingMode", teachingMode.name());
        }
        URI uri = builder.build().toUri();
        PublicClassSemanticSourceResponse response = restClient.get()
                .uri(uri)
                .retrieve()
                .body(PublicClassSemanticSourceResponse.class);
        return response == null || response.content() == null ? List.of() : response.content();
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:8082";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
