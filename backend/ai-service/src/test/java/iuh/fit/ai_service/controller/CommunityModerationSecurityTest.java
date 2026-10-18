package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.service.CommunityModerationClassifier;
import iuh.fit.ai_service.service.CommunityRewriteAssistant;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CommunityModerationSecurityTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF";
    private final CommunityModerationClassifier classifier = mock(CommunityModerationClassifier.class);
    private final CommunityRewriteAssistant rewriteAssistant = mock(CommunityRewriteAssistant.class);
    private final CommunityModerationController controller = new CommunityModerationController(SECRET, classifier, rewriteAssistant);
    private final CommunityModerationClassifier.Request request = new CommunityModerationClassifier.Request("TUTOR_POLL", "a", "b");

    private String token(String subject, String scope, long seconds) {
        var builder = Jwts.builder().subject(subject).expiration(Date.from(Instant.now().plusSeconds(seconds)));
        if (scope != null) builder.claim("serviceScope", scope);
        return builder.signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }

    @Test void acceptsOnlyScopedLearningService() {
        controller.moderate(token("learning-service", "community-moderation", 60), request);
        verify(classifier).classify(request);
        for (String invalid : new String[]{"bad", token("student", null, 60), token("contract-service", "community-moderation", 60),
                token("learning-service", null, 60), token("learning-service", "community-moderation", -60)}) {
            assertEquals(401, assertThrows(ResponseStatusException.class, () -> controller.moderate(invalid, request)).getStatusCode().value());
        }
        assertThrows(ResponseStatusException.class, () -> controller.moderate(null, request));
        verifyNoMoreInteractions(classifier);
    }

    @Test void rewriteRequiresItsDedicatedScope() {
        var request = new CommunityRewriteAssistant.Request("TUTOR_POLL", "a", "b", "REJECTED",
                java.util.List.of("SPAM"), "Lý do");
        controller.rewrite(token("learning-service", "community-rewrite", 60), request);
        verify(rewriteAssistant).rewrite(request);
        assertEquals(401, assertThrows(ResponseStatusException.class,
                () -> controller.rewrite(token("learning-service", "community-moderation", 60), request))
                .getStatusCode().value());
        assertEquals(401, assertThrows(ResponseStatusException.class,
                () -> controller.rewrite(token("student", "community-rewrite", 60), request))
                .getStatusCode().value());
    }
}
