package iuh.fit.api_gateway.reporting;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/operational-work-items/v1")
public class OperationalWorkItemController {
    private final OperationalWorkItemService service;
    private final OperationalSlaNotificationPublisher notificationPublisher;

    public OperationalWorkItemController(OperationalWorkItemService service,
                                         OperationalSlaNotificationPublisher notificationPublisher) {
        this.service = service;
        this.notificationPublisher = notificationPublisher;
    }

    @GetMapping
    public Mono<OperationalWorkItemService.WorkItemPage> page(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestHeader(value = HttpHeaders.COOKIE, required = false) String cookie,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return service.page(page, size, cookie, authorization)
                .flatMap(result -> notificationPublisher.publish(result.content()).thenReturn(result))
                .onErrorMap(IllegalArgumentException.class,
                        error -> new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage(), error))
                .onErrorMap(WebClientResponseException.class, error -> {
                    if (error.getStatusCode().value() == 401) {
                        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required", error);
                    }
                    if (error.getStatusCode().value() == 403) {
                        return new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient work-item permission", error);
                    }
                    return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Operational source unavailable", error);
                });
    }

    @GetMapping("/summary")
    public Mono<OperationalWorkItemService.SlaSummary> summary(
            @RequestHeader(value = HttpHeaders.COOKIE, required = false) String cookie,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return service.slaSummary(cookie, authorization)
                .onErrorMap(WebClientResponseException.class, error -> {
                    if (error.getStatusCode().value() == 401) {
                        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required", error);
                    }
                    if (error.getStatusCode().value() == 403) {
                        return new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient work-item permission", error);
                    }
                    return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Operational source unavailable", error);
                });
    }
}
