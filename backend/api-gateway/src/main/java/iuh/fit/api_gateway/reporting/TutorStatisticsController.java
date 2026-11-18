package iuh.fit.api_gateway.reporting;

import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/tutor-statistics/v1")
public class TutorStatisticsController {
    private final TutorStatisticsService service;
    private final GatewayAdminAuthorizer authorizer;

    public TutorStatisticsController(TutorStatisticsService service, GatewayAdminAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GetMapping
    public Mono<TutorStatisticsService.TutorStatisticsResponse> statistics(
            @RequestHeader(value = HttpHeaders.COOKIE, required = false) String cookie,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestParam(defaultValue = "30") int rangeDays
    ) {
        authorizer.requireTutor(cookie, authorization);
        return service.aggregate(cookie, authorization, rangeDays);
    }
}
