package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.support.SupportTicketDtos.Summary;
import iuh.fit.account_service.service.SupportTicketService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/operational-work-items")
@PreAuthorize("hasRole('INTERNAL_OPERATIONAL')")
public class InternalOperationalWorkItemController {
    private final SupportTicketService supportTickets;

    public InternalOperationalWorkItemController(SupportTicketService supportTickets) {
        this.supportTickets = supportTickets;
    }

    @GetMapping("/support-tickets")
    public Page<Summary> supportTickets(@RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "50") int size) {
        return supportTickets.listOperational(PageRequest.of(Math.max(0, page), Math.min(50, Math.max(1, size)),
                Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))));
    }
}
