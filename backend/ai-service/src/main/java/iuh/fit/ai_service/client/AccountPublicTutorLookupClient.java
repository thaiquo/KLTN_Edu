package iuh.fit.ai_service.client;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorSearchPage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Component
public class AccountPublicTutorLookupClient {
    private final RestClient restClient;
    private final String accountServiceUrl;

    public AccountPublicTutorLookupClient(
            RestClient.Builder restClientBuilder,
            @Value("${account.service.url:http://localhost:8081}") String accountServiceUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.accountServiceUrl = stripTrailingSlash(accountServiceUrl);
    }

    public TutorSearchPage search(Long subjectId, TeachingMode teachingMode, int previewSize) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(accountServiceUrl)
                .path("/api/tutors/search-v2")
                .queryParam("page", 0)
                .queryParam("size", Math.max(0, previewSize))
                .queryParam("sort", "name,asc");
        if (subjectId != null) {
            builder.queryParam("subjectId", subjectId);
        }
        if (teachingMode != null) {
            builder.queryParam("teachingMode", teachingMode.name());
        }
        URI uri = builder.build().toUri();
        return restClient.get()
                .uri(uri)
                .retrieve()
                .body(TutorSearchPage.class);
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:8081";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
