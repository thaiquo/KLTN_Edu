package iuh.fit.notification_service.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;

@Component
public class AccountChatIdentityClient {
    private final RestClient restClient;
    private final String accountServiceUrl;

    public AccountChatIdentityClient(
            RestClient.Builder restClientBuilder,
            @Value("${account.service.url:http://localhost:8081}") String accountServiceUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.accountServiceUrl = stripTrailingSlash(accountServiceUrl);
    }

    public ChatIdentity getIdentity(Long userId) {
        URI uri = UriComponentsBuilder.fromUriString(accountServiceUrl)
                .path("/api/users/chat-identities/{userId}")
                .build(userId);
        try {
            ChatIdentity identity = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(ChatIdentity.class);
            if (identity == null || identity.userId() == null) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Account identity lookup returned no data");
            }
            return identity;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat recipient not found", ex);
        } catch (HttpClientErrorException ex) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chat recipient is not available", ex);
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Account identity lookup is unavailable", ex);
        }
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:8081";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    public record ChatIdentity(
            Long userId,
            String email,
            String fullName,
            String avatarUrl,
            String accountStatus,
            List<String> roles,
            boolean hasStudentProfile,
            boolean hasTutorProfile,
            boolean tutorApproved,
            Long tutorProfileId
    ) {
        public boolean isActive() {
            return "ACTIVE".equalsIgnoreCase(accountStatus);
        }

        public boolean hasRole(String role) {
            return roles != null && roles.stream().anyMatch(value -> role.equalsIgnoreCase(value));
        }
    }
}
