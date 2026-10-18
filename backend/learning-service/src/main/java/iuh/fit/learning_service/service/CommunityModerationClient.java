package iuh.fit.learning_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Component
public class CommunityModerationClient {
    public record Request(String postType, String title, String content) {}
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final ObjectMapper mapper;
    private final SecretKey key;
    private final String url;

    public CommunityModerationClient(@Value("${jwt.secret}") String secret,
                                     @Value("${AI_SERVICE_URL:http://localhost:8085}") String url) {
        this.mapper = new ObjectMapper();
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.url = url.replaceAll("/+$", "");
    }

    public CommunityModerationPolicy.Result moderate(Request content) {
        try {
            String token = Jwts.builder().subject("learning-service").claim("serviceScope", "community-moderation")
                    .expiration(Date.from(Instant.now().plusSeconds(60))).signWith(key).compact();
            var request = HttpRequest.newBuilder(URI.create(url + "/api/ai/internal/community/moderate"))
                    .timeout(Duration.ofSeconds(20)).header("Content-Type", "application/json")
                    .header("X-Service-Token", token)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(content))).build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body().isBlank()) return null;
            return mapper.readValue(response.body(), CommunityModerationPolicy.Result.class);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception ex) {
            return null;
        }
    }
}
