package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.service.CommunityModerationClassifier;
import iuh.fit.ai_service.service.CommunityModerationClassifier.Request;
import iuh.fit.ai_service.service.CommunityModerationClassifier.Result;
import iuh.fit.ai_service.service.CommunityRewriteAssistant;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/ai/internal/community")
public class CommunityModerationController {
    private final SecretKey key;
    private final CommunityModerationClassifier classifier;
    private final CommunityRewriteAssistant rewriteAssistant;

    public CommunityModerationController(@Value("${jwt.secret}") String secret,
                                         CommunityModerationClassifier classifier,
                                         CommunityRewriteAssistant rewriteAssistant) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.classifier = classifier;
        this.rewriteAssistant = rewriteAssistant;
    }

    @PostMapping("/moderate")
    public Result moderate(@RequestHeader(value = "X-Service-Token", required = false) String token,
                           @RequestBody Request request) {
        authenticate(token, "community-moderation");
        return classifier.classify(request);
    }

    @PostMapping("/rewrite")
    public CommunityRewriteAssistant.Result rewrite(
            @RequestHeader(value = "X-Service-Token", required = false) String token,
            @RequestBody CommunityRewriteAssistant.Request request) {
        authenticate(token, "community-rewrite");
        return rewriteAssistant.rewrite(request);
    }

    private void authenticate(String token, String requiredScope) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if (!"learning-service".equals(claims.getSubject())
                    || !requiredScope.equals(claims.get("serviceScope", String.class))
                    || claims.getExpiration() == null) throw new IllegalArgumentException();
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Service authentication required");
        }
    }
}
