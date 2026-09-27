package iuh.fit.learning_service.service;

import iuh.fit.learning_service.controller.LearningTerminationController;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class TerminationAuthenticationTest {
    private final String secret = "test-learning-termination-secret-at-least-32-bytes";
    @Test void browserAndWrongServiceCannotFreezeClass() {
        var service = mock(LearningTerminationService.class);
        var controller = new LearningTerminationController(service, secret);
        assertThatThrownBy(() -> controller.apply(null, null)).hasMessageContaining("403");
        String token = Jwts.builder().subject("learning-service").claim("serviceScope", "contract-settlement")
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
        assertThatThrownBy(() -> controller.apply(token, null)).hasMessageContaining("403");
        verifyNoInteractions(service);
    }
}
