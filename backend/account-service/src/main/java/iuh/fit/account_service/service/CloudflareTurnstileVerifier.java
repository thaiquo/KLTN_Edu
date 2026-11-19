package iuh.fit.account_service.service;

import iuh.fit.account_service.config.TurnstileProperties;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

@Component
public class CloudflareTurnstileVerifier implements TurnstileVerifier {
    private final TurnstileProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public CloudflareTurnstileVerifier(TurnstileProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(properties.getConnectTimeout()).build();
    }

    @Override
    public VerificationResult verify(String token, String remoteIp) {
        if (!properties.isEnabled()) return VerificationResult.UNAVAILABLE;
        try {
            StringBuilder form = new StringBuilder()
                    .append("secret=").append(encode(properties.getSecretKey()))
                    .append("&response=").append(encode(token));
            if (remoteIp != null && !remoteIp.isBlank()) {
                form.append("&remoteip=").append(encode(remoteIp));
            }
            HttpRequest request = HttpRequest.newBuilder(URI.create(properties.getSiteverifyUrl()))
                    .timeout(properties.getReadTimeout())
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form.toString()))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) return VerificationResult.UNAVAILABLE;
            SiteverifyResponse result = objectMapper.readValue(response.body(), SiteverifyResponse.class);
            if (!result.success()) return VerificationResult.INVALID;
            if (properties.usesTestKey()) return VerificationResult.VALID;
            if (properties.getExpectedAction() != null && !properties.getExpectedAction().isBlank()
                    && !properties.getExpectedAction().equals(result.action())) return VerificationResult.INVALID;
            if (!properties.getAllowedHostnames().isEmpty()
                    && (result.hostname() == null || properties.getAllowedHostnames().stream()
                    .noneMatch(host -> host.equalsIgnoreCase(result.hostname())))) return VerificationResult.INVALID;
            return VerificationResult.VALID;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return VerificationResult.UNAVAILABLE;
        } catch (Exception exception) {
            return VerificationResult.UNAVAILABLE;
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private record SiteverifyResponse(
            boolean success,
            String hostname,
            String action
    ) {}
}
