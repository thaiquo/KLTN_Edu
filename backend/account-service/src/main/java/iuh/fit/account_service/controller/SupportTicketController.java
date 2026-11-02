package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.support.SupportTicketDtos.*;
import iuh.fit.account_service.enums.SupportTicketStatus;
import iuh.fit.account_service.service.SupportTicketService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/support/tickets")
public class SupportTicketController {
    private final SupportTicketService service;
    public SupportTicketController(SupportTicketService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<Detail> create(@Valid @RequestBody CreateRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, authentication));
    }

    @GetMapping
    public Page<Summary> list(@RequestParam(required = false) SupportTicketStatus status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size,
            Authentication authentication) {
        return service.list(status, keyword, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))), authentication);
    }

    @GetMapping("/{id}")
    public Detail get(@PathVariable UUID id, Authentication authentication) {
        return service.get(id, authentication);
    }

    @PostMapping("/{id}/claim")
    public Detail claim(@PathVariable UUID id, Authentication authentication) {
        return service.claim(id, authentication);
    }

    @PostMapping("/{id}/messages")
    public Detail message(@PathVariable UUID id, @Valid @RequestBody MessageRequest request,
                          Authentication authentication) {
        return service.addMessage(id, request, authentication);
    }

    @PatchMapping("/{id}/status")
    public Detail status(@PathVariable UUID id, @Valid @RequestBody StatusRequest request,
                         Authentication authentication) {
        return service.updateStatus(id, request, authentication);
    }

    @PostMapping("/{id}/escalate")
    public Detail escalate(@PathVariable UUID id, @Valid @RequestBody EscalateRequest request,
                           Authentication authentication) {
        return service.escalate(id, request, authentication);
    }
}
