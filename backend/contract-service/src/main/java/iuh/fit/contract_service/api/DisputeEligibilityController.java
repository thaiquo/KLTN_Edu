package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@RestController
@RequestMapping("/api/contracts/disputes")
@RequiredArgsConstructor
public class DisputeEligibilityController {
    private final SessionSettlementRepository settlements;
    private final CurrentUserContext users;

    @GetMapping("/eligible-sessions")
    public Page<EligibleDisputeSession> eligibleSessions(
            @RequestParam(required = false) Long sessionId,
            @RequestParam(required = false) Long classroomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        var user = users.requireCurrentUser();
        if (!user.hasActiveAuthority("STUDENT")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student role is required");
        }
        var pageable = PageRequest.of(
                Math.max(0, page),
                Math.min(50, Math.max(1, size)),
                Sort.by(Sort.Order.asc("disputeDeadline"), Sort.Order.asc("id")));
        return settlements.findEligibleStudentDisputes(
                        user.userId(), user.email(), OffsetDateTime.now(ZoneOffset.UTC),
                        sessionId, classroomId, pageable)
                .map(settlement -> {
                    var agreement = settlement.getAgreement();
                    return new EligibleDisputeSession(
                            agreement.getId(), agreement.getClassroomId(), agreement.getClassName(),
                            agreement.getStudentName(), settlement.getSessionId(), settlement.getDisputeDeadline());
                });
    }

    public record EligibleDisputeSession(
            UUID agreementId,
            Long classroomId,
            String className,
            String studentName,
            Long sessionId,
            OffsetDateTime disputeDeadline) {
    }
}
