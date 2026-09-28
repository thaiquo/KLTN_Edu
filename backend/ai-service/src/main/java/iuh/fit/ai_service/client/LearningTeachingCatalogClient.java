package iuh.fit.ai_service.client;

import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCatalogSnapshot;
import iuh.fit.ai_service.service.CatalogGroundingService.CatalogGroundingUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClient;

@Component
public class LearningTeachingCatalogClient implements LearningCatalogClient {
    private final RestClient restClient;
    private final String learningServiceUrl;

    public LearningTeachingCatalogClient(
            RestClient.Builder restClientBuilder,
            @Value("${learning.service.url:http://localhost:8082}") String learningServiceUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.learningServiceUrl = stripTrailingSlash(learningServiceUrl);
    }

    @Override
    public LearningCatalogSnapshot groundingSnapshot() {
        try {
            return restClient.get()
                    .uri(learningServiceUrl + "/api/teaching-catalog/grounding-snapshot")
                    .retrieve()
                    .body(LearningCatalogSnapshot.class);
        } catch (RestClientException exception) {
            throw new CatalogGroundingUnavailableException("Learning catalog is unavailable: " + exception.getMessage());
        }
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:8082";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
