package iuh.fit.api_gateway.reporting;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/operational-reports")
public class OperationalReportController {
    private final OperationalReportService service;

    public OperationalReportController(OperationalReportService service) {
        this.service = service;
    }

    @GetMapping("/activities")
    public Mono<OperationalReportService.ReportPage> activities(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "ALL") String domain,
            @RequestParam(defaultValue = "ALL") String outcome,
            @RequestParam(defaultValue = "ALL") String staff,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestHeader(value = HttpHeaders.COOKIE, required = false) String cookie,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        if (page < 0 || size < 1 || size > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be >= 0 and size must be between 1 and 50");
        }
        return service.page(
                        new OperationalReportService.Query(page, size, domain, outcome, staff, search, from, to),
                        cookie, authorization)
                .onErrorMap(IllegalArgumentException.class,
                        error -> new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage(), error))
                .onErrorMap(WebClientResponseException.class, error -> {
                    if (error.getStatusCode().value() == HttpStatus.UNAUTHORIZED.value()) {
                        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required", error);
                    }
                    if (error.getStatusCode().value() == HttpStatus.FORBIDDEN.value()) {
                        return new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient report permission", error);
                    }
                    return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Operational report source unavailable", error);
                })
                .onErrorMap(error -> !(error instanceof ResponseStatusException),
                        error -> new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Operational report source unavailable", error));
    }
}
