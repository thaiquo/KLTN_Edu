package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.service.LearningTerminationService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;

@RestController
@RequestMapping("/api/learning/internal/termination")
public class LearningTerminationController {
    private final LearningTerminationService service;
    private final SecretKey key;
    @ExceptionHandler({IllegalStateException.class, IllegalArgumentException.class, java.util.NoSuchElementException.class})
    @ResponseStatus(HttpStatus.CONFLICT)
    public java.util.Map<String, String> conflict(RuntimeException error) {
        return java.util.Map.of("error", error.getMessage() == null ? "Learning termination state mismatch" : error.getMessage());
    }
    public LearningTerminationController(LearningTerminationService service, @Value("${jwt.secret}") String secret) {
        this.service = service;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
    @PostMapping
    public LearningTerminationService.Snapshot apply(
            @RequestHeader(value = "X-Service-Token", required = false) String token,
            @RequestBody LearningTerminationService.Command command) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if (!"contract-service".equals(claims.getSubject())
                    || !"learning-termination".equals(claims.get("serviceScope", String.class))
                    || claims.getExpiration() == null) throw new IllegalArgumentException();
        } catch (Exception invalidToken) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Internal service authentication required");
        }
        return service.apply(command);
    }
}
