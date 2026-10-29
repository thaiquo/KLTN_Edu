package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.entity.DisputeHistory;
import iuh.fit.contract_service.enums.DisputeEscalationStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.repository.DisputeHistoryRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class DisputeEscalationService {
    private final DisputeRepository disputes;
    private final DisputeHistoryRepository history;
    private final TerminationNotificationOutbox notifications;

    public DisputeEscalationService(DisputeRepository disputes, DisputeHistoryRepository history,
                                    TerminationNotificationOutbox notifications) {
        this.disputes = disputes;
        this.history = history;
        this.notifications = notifications;
    }

    @Transactional
    public Dispute requestEscalation(UUID disputeId, String reason, String requestKey,
                                     ContractUserPrincipal actor) {
        requireRole(actor, "STAFF");
        String normalizedReason = requireReason(reason, 2000, "Escalation reason is required");
        String key = idempotencyKey("ESCALATE", disputeId, requestKey);
        var replay = history.findByIdempotencyKey(key);
        if (replay.isPresent()) return disputes.findByIdWithSettlementAndAgreement(disputeId).orElseThrow();

        Dispute dispute = lock(disputeId);
        requireAssignedStaff(dispute, actor);
        if (dispute.getStatus() != DisputeStatus.OPEN) {
            throw conflict("Only an OPEN dispute can be escalated");
        }
        DisputeEscalationStatus from = normalized(dispute);
        if (from == DisputeEscalationStatus.PENDING_ADMIN || from == DisputeEscalationStatus.ACCEPTED_BY_ADMIN) {
            throw conflict("Dispute is already under Admin escalation");
        }

        dispute.setEscalationStatus(DisputeEscalationStatus.PENDING_ADMIN);
        dispute.setEscalationReason(normalizedReason);
        dispute.setEscalatedByUserId(actor.userId());
        dispute.setEscalatedByEmail(actor.email());
        dispute.setEscalatedAt(Instant.now());
        dispute.setEscalationHandledByUserId(null);
        dispute.setEscalationHandledByEmail(null);
        dispute.setEscalationHandledAt(null);
        dispute.setEscalationReturnReason(null);
        disputes.save(dispute);
        append(dispute, actor, "ESCALATED_TO_ADMIN", from.name(), DisputeEscalationStatus.PENDING_ADMIN.name(), normalizedReason, key);
        notifications.enqueue(notificationEventId("escalated", disputeId, key),
                new TerminationNotificationOutbox.Intent(null, null,
                        "Khiếu nại được chuyển cấp", "Staff " + actor.email() + " đã chuyển một khiếu nại lên Admin.",
                        "DISPUTE_ESCALATED", "DISPUTE", disputeId.toString()));
        return dispute;
    }

    @Transactional
    public Dispute accept(UUID disputeId, String reason, String requestKey, ContractUserPrincipal actor) {
        requireRole(actor, "ADMIN");
        String key = idempotencyKey("ACCEPT", disputeId, requestKey);
        var replay = history.findByIdempotencyKey(key);
        if (replay.isPresent()) return disputes.findByIdWithSettlementAndAgreement(disputeId).orElseThrow();
        Dispute dispute = lock(disputeId);
        if (normalized(dispute) != DisputeEscalationStatus.PENDING_ADMIN) {
            throw conflict("Only a pending escalation can be accepted");
        }
        dispute.setEscalationStatus(DisputeEscalationStatus.ACCEPTED_BY_ADMIN);
        markHandled(dispute, actor);
        disputes.save(dispute);
        append(dispute, actor, "ADMIN_ACCEPTED", DisputeEscalationStatus.PENDING_ADMIN.name(),
                DisputeEscalationStatus.ACCEPTED_BY_ADMIN.name(), optionalReason(reason, 2000), key);
        notifyAssignedStaff(dispute, "Admin đã tiếp nhận khiếu nại", "Admin đã tiếp nhận hồ sơ chuyển cấp.",
                "DISPUTE_ESCALATION_ACCEPTED", key);
        return dispute;
    }

    @Transactional
    public Dispute returnToStaff(UUID disputeId, String reason, String requestKey, ContractUserPrincipal actor) {
        requireRole(actor, "ADMIN");
        String normalizedReason = requireReason(reason, 2000, "Return reason is required");
        String key = idempotencyKey("RETURN", disputeId, requestKey);
        var replay = history.findByIdempotencyKey(key);
        if (replay.isPresent()) return disputes.findByIdWithSettlementAndAgreement(disputeId).orElseThrow();
        Dispute dispute = lock(disputeId);
        DisputeEscalationStatus from = normalized(dispute);
        if (from != DisputeEscalationStatus.PENDING_ADMIN && from != DisputeEscalationStatus.ACCEPTED_BY_ADMIN) {
            throw conflict("Only a pending or accepted escalation can be returned");
        }
        dispute.setEscalationStatus(DisputeEscalationStatus.RETURNED_TO_STAFF);
        dispute.setEscalationReturnReason(normalizedReason);
        markHandled(dispute, actor);
        disputes.save(dispute);
        append(dispute, actor, "RETURNED_TO_STAFF", from.name(),
                DisputeEscalationStatus.RETURNED_TO_STAFF.name(), normalizedReason, key);
        notifyAssignedStaff(dispute, "Khiếu nại được trả lại", normalizedReason,
                "DISPUTE_ESCALATION_RETURNED", key);
        return dispute;
    }

    @Transactional(readOnly = true)
    public List<DisputeHistory> timeline(UUID disputeId, ContractUserPrincipal actor) {
        Dispute dispute = disputes.findByIdWithSettlementAndAgreement(disputeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispute not found"));
        boolean admin = actor.hasActiveAuthority("ADMIN");
        boolean assignedStaff = actor.hasActiveAuthority("STAFF")
                && actor.matchesEmail(dispute.getSettlement().getAgreement().getClassroomReviewerEmail());
        if (!admin && !assignedStaff) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        return history.findByDisputeIdOrderByCreatedAtAscIdAsc(disputeId);
    }

    private void notifyAssignedStaff(Dispute dispute, String title, String content, String type, String key) {
        notifications.enqueue(notificationEventId(type.toLowerCase(Locale.ROOT), dispute.getId(), key),
                new TerminationNotificationOutbox.Intent(null,
                        dispute.getSettlement().getAgreement().getClassroomReviewerEmail(),
                        title, content, type, "DISPUTE", dispute.getId().toString()));
    }

    private void append(Dispute dispute, ContractUserPrincipal actor, String action, String from, String to,
                        String reason, String key) {
        history.save(DisputeHistory.builder().id(UUID.randomUUID()).dispute(dispute)
                .actorUserId(actor.userId()).actorEmail(actor.email()).actorRole(actor.activeRole())
                .action(action).fromState(from).toState(to).reason(reason).idempotencyKey(key).build());
    }

    private Dispute lock(UUID id) {
        return disputes.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispute not found"));
    }

    private void requireAssignedStaff(Dispute dispute, ContractUserPrincipal actor) {
        if (!actor.matchesEmail(dispute.getSettlement().getAgreement().getClassroomReviewerEmail())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff can escalate only assigned disputes");
        }
    }

    private void requireRole(ContractUserPrincipal actor, String role) {
        if (!actor.hasActiveAuthority(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
    }

    private void markHandled(Dispute dispute, ContractUserPrincipal actor) {
        dispute.setEscalationHandledByUserId(actor.userId());
        dispute.setEscalationHandledByEmail(actor.email());
        dispute.setEscalationHandledAt(Instant.now());
    }

    private DisputeEscalationStatus normalized(Dispute dispute) {
        return dispute.getEscalationStatus() == null ? DisputeEscalationStatus.NONE : dispute.getEscalationStatus();
    }

    private String requireReason(String value, int max, String message) {
        String normalized = optionalReason(value, max);
        if (normalized == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        return normalized;
    }

    private String optionalReason(String value, int max) {
        if (value == null || value.trim().isEmpty()) return null;
        String normalized = value.trim();
        if (normalized.length() > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reason is too long");
        return normalized;
    }

    private String idempotencyKey(String action, UUID disputeId, String supplied) {
        String suffix = supplied == null || supplied.isBlank() ? UUID.randomUUID().toString() : supplied.trim();
        if (suffix.length() > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency key is too long");
        return action + ":" + disputeId + ":" + suffix;
    }

    private String notificationEventId(String action, UUID disputeId, String key) {
        return "dispute:" + action + ":" + disputeId + ":" + UUID.nameUUIDFromBytes(key.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
