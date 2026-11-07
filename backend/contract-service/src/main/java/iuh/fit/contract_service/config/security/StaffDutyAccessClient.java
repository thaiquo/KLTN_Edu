package iuh.fit.contract_service.config.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Component
public class StaffDutyAccessClient {
    private final RestClient client;
    private final SecretKey key;

    public StaffDutyAccessClient(
            @Value("${account.service.url:${ACCOUNT_SERVICE_URL:http://localhost:8081}}") String accountUrl,
            @Value("${jwt.secret}") String secret
    ) {
        this.client = RestClient.builder().baseUrl(accountUrl).build();
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public boolean isWriteAllowed(String staffEmail) {
        Response response = client.get()
                .uri(builder -> builder.path("/api/internal/staff-duty/write-access")
                        .queryParam("staffEmail", staffEmail).build())
                .header("X-Service-Token", serviceToken())
                .retrieve()
                .body(Response.class);
        return response != null && response.allowed();
    }

    private String serviceToken() {
        Instant now = Instant.now();
        return Jwts.builder().subject("contract-service")
                .claim("serviceScope", "staff-duty-check")
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30)))
                .signWith(key).compact();
    }

    private record Response(boolean allowed) {}
}
