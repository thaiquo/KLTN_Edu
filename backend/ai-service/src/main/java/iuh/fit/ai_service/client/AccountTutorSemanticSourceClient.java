package iuh.fit.ai_service.client;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorSearchPage;
import iuh.fit.ai_service.service.semantic.TutorSemanticSourceClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

@Component
public class AccountTutorSemanticSourceClient implements TutorSemanticSourceClient {
    private static final int PAGE_SIZE = 50;

    private final RestClient restClient;
    private final String accountServiceUrl;

    public AccountTutorSemanticSourceClient(
            RestClient.Builder restClientBuilder,
            @Value("${account.service.url:http://localhost:8081}") String accountServiceUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.accountServiceUrl = stripTrailingSlash(accountServiceUrl);
    }

    @Override
    public List<TutorCandidate> findEligibleTutorsForSemanticIndexing() {
        List<TutorCandidate> candidates = new ArrayList<>();
        int page = 0;
        TutorSearchPage response;
        do {
            response = fetchPage(page);
            if (response == null || response.content() == null) {
                break;
            }
            candidates.addAll(response.content());
            page++;
        } while (!response.last() && page < response.totalPages());
        return candidates;
    }

    private TutorSearchPage fetchPage(int page) {
        URI uri = UriComponentsBuilder.fromHttpUrl(accountServiceUrl)
                .path("/api/tutors/search-v2")
                .queryParam("page", page)
                .queryParam("size", PAGE_SIZE)
                .queryParam("sort", "name,asc")
                .build()
                .toUri();
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
