package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.entity.DisputeHistory;
import iuh.fit.contract_service.enums.DisputeEscalationStatus;
import iuh.fit.contract_service.repository.DisputeRepository;
import iuh.fit.contract_service.service.DisputeEscalationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/contracts/disputes")
public class DisputeEscalationController {
    private final DisputeEscalationService service;
    private final DisputeRepository disputes;
    private final CurrentUserContext users;

    public DisputeEscalationController(DisputeEscalationService service, DisputeRepository disputes,
                                       CurrentUserContext users) {
        this.service = service;
        this.disputes = disputes;
        this.users = users;
    }

    public record ReasonRequest(@NotBlank @Size(max = 2000) String reason) {}

    @PostMapping("/{id}/escalation")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<EscalationDto> escalate(@PathVariable UUID id,
            @Valid @RequestBody ReasonRequest body,
            @RequestHeader(value = "Idempotency-Key", required = false) String requestKey) {
        return ResponseEntity.ok(toDto(service.requestEscalation(id, body.reason(), requestKey, users.requireCurrentUser())));
    }

    @GetMapping("/escalations")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<EscalationDto> queue(
            @RequestParam(required = false) DisputeEscalationStatus status,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 10, sort = "escalatedAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        String normalizedKeyword = keyword == null || keyword.isBlank() ? null : keyword.trim();
        Pageable safePageable = PageRequest.of(Math.max(0, pageable.getPageNumber()),
                Math.min(50, Math.max(1, pageable.getPageSize())),
                Sort.by(Sort.Order.desc("escalatedAt"), Sort.Order.desc("id")));
        Page<Dispute> result = normalizedKeyword == null
                ? disputes.findEscalationQueue(status, safePageable)
                : disputes.findEscalationQueue(status, normalizedKeyword, safePageable);
        return result.map(this::toDto);
    }

    @PostMapping("/{id}/escalation/accept")
    @PreAuthorize("hasRole('ADMIN')")
    public EscalationDto accept(@PathVariable UUID id,
            @RequestBody(required = false) ReasonRequest body,
            @RequestHeader(value = "Idempotency-Key", required = false) String requestKey) {
        return toDto(service.accept(id, body == null ? null : body.reason(), requestKey, users.requireCurrentUser()));
    }

    @PostMapping("/{id}/escalation/return")
    @PreAuthorize("hasRole('ADMIN')")
    public EscalationDto returnToStaff(@PathVariable UUID id,
            @Valid @RequestBody ReasonRequest body,
            @RequestHeader(value = "Idempotency-Key", required = false) String requestKey) {
        return toDto(service.returnToStaff(id, body.reason(), requestKey, users.requireCurrentUser()));
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<HistoryDto> history(@PathVariable UUID id) {
        return service.timeline(id, users.requireCurrentUser()).stream().map(this::toHistoryDto).toList();
    }

    private EscalationDto toDto(Dispute dispute) {
        var agreement = dispute.getSettlement().getAgreement();
        return new EscalationDto(dispute.getId(), dispute.getStatus().name(),
                dispute.getEscalationStatus() == null ? DisputeEscalationStatus.NONE : dispute.getEscalationStatus(),
                dispute.getReason(), dispute.getEscalationReason(), dispute.getEscalatedByEmail(), dispute.getEscalatedAt(),
                dispute.getEscalationHandledByEmail(), dispute.getEscalationHandledAt(), dispute.getEscalationReturnReason(),
                agreement.getClassroomId(), agreement.getClassName(), agreement.getClassroomReviewerEmail(),
                dispute.getSettlement().getSessionId(), dispute.getVersion());
    }

    private HistoryDto toHistoryDto(DisputeHistory item) {
        return new HistoryDto(item.getId(), item.getAction(), item.getFromState(), item.getToState(), item.getReason(),
                item.getActorEmail(), item.getActorRole(), item.getCreatedAt());
    }

    public record EscalationDto(UUID id, String disputeStatus, DisputeEscalationStatus escalationStatus,
            String disputeReason, String escalationReason, String escalatedByEmail, java.time.Instant escalatedAt,
            String handledByEmail, java.time.Instant handledAt, String returnReason,
            Long classroomId, String className, String assignedStaffEmail, Long sessionId, Long version) {}

    public record HistoryDto(UUID id, String action, String fromState, String toState, String reason,
            String actorEmail, String actorRole, java.time.Instant createdAt) {}
}
