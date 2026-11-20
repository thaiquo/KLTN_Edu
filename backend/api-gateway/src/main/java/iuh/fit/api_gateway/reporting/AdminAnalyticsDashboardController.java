package iuh.fit.api_gateway.reporting;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/operations/dashboard/v1")
public class AdminAnalyticsDashboardController {
    private final AdminAnalyticsDashboardService service;
    private final GatewayAdminAuthorizer authorizer;

    public AdminAnalyticsDashboardController(AdminAnalyticsDashboardService service,
                                             GatewayAdminAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GetMapping
    public Mono<AdminAnalyticsDashboardService.DashboardResponse> dashboard(
            @RequestParam(defaultValue = "30") int rangeDays,
            @RequestHeader(value = HttpHeaders.COOKIE, required = false) String cookie,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        authorizer.requireAdmin(cookie, authorization);
        try {
            return service.dashboard(cookie, authorization, rangeDays);
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage(), error);
        }
    }
}
