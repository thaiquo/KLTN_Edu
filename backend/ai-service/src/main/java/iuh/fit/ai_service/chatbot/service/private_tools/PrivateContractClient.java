package iuh.fit.ai_service.chatbot.service.private_tools;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;

@Component
public class PrivateContractClient {
    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_OF_MAPS =
            new ParameterizedTypeReference<>() {};

    private final RestClient restClient;
    private final String contractServiceUrl;
    private final CallerAuthForwarder authForwarder;

    public PrivateContractClient(
            RestClient.Builder restClientBuilder,
            @Value("${contract.service.url:http://localhost:8083}") String contractServiceUrl,
            CallerAuthForwarder authForwarder
    ) {
        this.restClient = restClientBuilder.build();
        this.contractServiceUrl = stripTrailingSlash(contractServiceUrl);
        this.authForwarder = authForwarder;
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> agreements(int size) {
        URI uri = UriComponentsBuilder.fromHttpUrl(contractServiceUrl)
                .path("/api/contracts/agreements")
                .queryParam("page", 0)
                .queryParam("size", Math.max(1, Math.min(size, 30)))
                .build()
                .toUri();
        Map<String, Object> page = get(uri, MAP);
        Object content = page == null ? null : page.get("content");
        return content instanceof List<?> list
                ? list.stream().filter(Map.class::isInstance).map(item -> (Map<String, Object>) item).toList()
                : List.of();
    }

    public List<Map<String, Object>> settlements(String agreementId) {
        if (agreementId == null || agreementId.isBlank()) {
            return List.of();
        }
        URI uri = URI.create(contractServiceUrl + "/api/contracts/agreements/" + agreementId + "/settlements");
        List<Map<String, Object>> response = get(uri, LIST_OF_MAPS);
        return response == null ? List.of() : response;
    }

    private <T> T get(URI uri, ParameterizedTypeReference<T> type) {
        try {
            return restClient.get()
                    .uri(uri)
                    .headers(authForwarder::apply)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        if (response.getStatusCode().value() == 401) {
                            throw new PrivateToolException(PrivateToolException.Reason.UNAUTHORIZED, "Contract authentication expired");
                        }
                        if (response.getStatusCode().value() == 403) {
                            throw new PrivateToolException(PrivateToolException.Reason.FORBIDDEN, "Contract access denied");
                        }
                        throw new PrivateToolException(PrivateToolException.Reason.DOWNSTREAM_UNAVAILABLE, "Contract request failed");
                    })
                    .body(type);
        } catch (PrivateToolException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new PrivateToolException(PrivateToolException.Reason.DOWNSTREAM_UNAVAILABLE, "Contract service unavailable");
        }
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:8083";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
