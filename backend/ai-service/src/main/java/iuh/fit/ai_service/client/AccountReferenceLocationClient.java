package iuh.fit.ai_service.client;

import iuh.fit.ai_service.dto.RequirementGroundingDtos.LocationSnapshot;
import iuh.fit.ai_service.service.CatalogGroundingService.LocationGroundingUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class AccountReferenceLocationClient implements AccountLocationClient {
    private final RestClient restClient;
    private final String accountServiceUrl;

    public AccountReferenceLocationClient(
            RestClient.Builder restClientBuilder,
            @Value("${account.service.url:http://localhost:8081}") String accountServiceUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.accountServiceUrl = stripTrailingSlash(accountServiceUrl);
    }

    @Override
    public LocationSnapshot locationSnapshot() {
        try {
            return restClient.get()
                    .uri(accountServiceUrl + "/api/reference/locations/snapshot")
                    .retrieve()
                    .body(LocationSnapshot.class);
        } catch (RestClientException exception) {
            throw new LocationGroundingUnavailableException("Account location reference data is unavailable: " + exception.getMessage());
        }
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:8081";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
