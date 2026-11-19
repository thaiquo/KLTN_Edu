package iuh.fit.api_gateway.reporting;

import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.Instant;

@RestController
@RequestMapping("/api/operations/health/v1")
public class OperationalHealthController {
    private final OperationalWorkItemService workItems;
    private final GatewayAdminAuthorizer authorizer;

    public OperationalHealthController(OperationalWorkItemService workItems, GatewayAdminAuthorizer authorizer) {
        this.workItems = workItems;
        this.authorizer = authorizer;
    }

    @GetMapping
    public Mono<HealthDiagnostics> health(
            @RequestHeader(value = HttpHeaders.COOKIE, required = false) String cookie,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        authorizer.requireAdmin(cookie, authorization);
        return workItems.slaSummary(cookie, authorization)
                .map(summary -> new HealthDiagnostics(Instant.now().toString(), summary));
    }

    public record HealthDiagnostics(String generatedAt, OperationalWorkItemService.SlaSummary operational) { }
}
