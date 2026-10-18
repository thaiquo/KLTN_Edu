package iuh.fit.learning_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import iuh.fit.learning_service.exception.CommunityRewriteUnavailableException;
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
import java.util.List;

@Component
public class CommunityRewriteClient {
    public record Request(String postType, String title, String content, String moderationStatus,
                          List<String> moderationCategories, String moderationReason) {}
    public record Result(boolean canRewrite, String suggestedTitle, String suggestedContent,
                         String summaryOfChanges) {}

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final SecretKey key;
    private final String url;

    public CommunityRewriteClient(@Value("${jwt.secret}") String secret,
                                  @Value("${AI_SERVICE_URL:http://localhost:8085}") String url) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.url = url.replaceAll("/+$", "");
    }

    public Result rewrite(Request content) {
        try {
            String token = Jwts.builder().subject("learning-service").claim("serviceScope", "community-rewrite")
                    .expiration(Date.from(Instant.now().plusSeconds(60))).signWith(key).compact();
            HttpRequest request = HttpRequest.newBuilder(URI.create(url + "/api/ai/internal/community/rewrite"))
                    .timeout(Duration.ofSeconds(25)).header("Content-Type", "application/json")
                    .header("X-Service-Token", token)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(content))).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body().isBlank()) throw unavailable();
            Result result = mapper.readValue(response.body(), Result.class);
            if (result.summaryOfChanges() == null || result.summaryOfChanges().isBlank()
                    || result.canRewrite() && (result.suggestedTitle() == null || result.suggestedTitle().isBlank()
                    || result.suggestedContent() == null || result.suggestedContent().isBlank())) throw unavailable();
            return result;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw unavailable();
        } catch (CommunityRewriteUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            throw unavailable();
        }
    }

    private CommunityRewriteUnavailableException unavailable() {
        return new CommunityRewriteUnavailableException(
                "Hiện chưa thể tạo gợi ý chỉnh sửa. Vui lòng thử lại.");
    }
}
