package iuh.fit.api_gateway.reporting;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
public class OperationalSlaPolicy {
    private static final Set<String> TERMINAL_STATUSES = Set.of(
            "APPROVED", "REJECTED", "RESOLVED", "CLOSED", "COMPLETED", "CANCELLED", "CANCELED");

    private final Clock clock;
    private final ZoneId sourceZone;
    private final Duration businessDeadlineWarning;
    private final Map<String, Policy> policies;

    @Autowired
    public OperationalSlaPolicy(
            @Value("${operations.sla.source-zone:Asia/Ho_Chi_Minh}") ZoneId sourceZone,
            @Value("${operations.sla.business-deadline-warning:PT6H}") Duration businessDeadlineWarning,
            @Value("${operations.sla.tutor-application.target:P3D}") Duration tutorTarget,
            @Value("${operations.sla.tutor-application.warning:P1D}") Duration tutorWarning,
            @Value("${operations.sla.teaching-registration.target:P3D}") Duration teachingTarget,
            @Value("${operations.sla.teaching-registration.warning:P1D}") Duration teachingWarning,
            @Value("${operations.sla.class-approval.target:P2D}") Duration classTarget,
            @Value("${operations.sla.class-approval.warning:PT12H}") Duration classWarning,
            @Value("${operations.sla.community-moderation.target:P1D}") Duration communityTarget,
            @Value("${operations.sla.community-moderation.warning:PT4H}") Duration communityWarning,
            @Value("${operations.sla.support-ticket.target:P2D}") Duration supportTarget,
            @Value("${operations.sla.support-ticket.warning:PT8H}") Duration supportWarning) {
        this(Clock.systemUTC(), sourceZone, businessDeadlineWarning, Map.of(
                "TUTOR_APPLICATION", new Policy("M3_TUTOR_APPLICATION_V1", tutorTarget, tutorWarning),
                "TEACHING_REGISTRATION", new Policy("M3_TEACHING_REGISTRATION_V1", teachingTarget, teachingWarning),
                "CLASS_APPROVAL", new Policy("M3_CLASS_APPROVAL_V1", classTarget, classWarning),
                "COMMUNITY_MODERATION", new Policy("M3_COMMUNITY_MODERATION_V1", communityTarget, communityWarning),
                "SUPPORT_TICKET", new Policy("M3_SUPPORT_TICKET_V1", supportTarget, supportWarning)
        ));
    }

    OperationalSlaPolicy(Clock clock, ZoneId sourceZone, Duration businessDeadlineWarning,
                         Map<String, Policy> policies) {
        this.clock = clock;
        this.sourceZone = sourceZone;
        this.businessDeadlineWarning = businessDeadlineWarning;
        this.policies = Map.copyOf(policies);
    }

    static OperationalSlaPolicy defaults(Clock clock) {
        return new OperationalSlaPolicy(clock, ZoneId.of("Asia/Ho_Chi_Minh"), Duration.ofHours(6), Map.of(
                "TUTOR_APPLICATION", new Policy("M3_TUTOR_APPLICATION_V1", Duration.ofDays(3), Duration.ofDays(1)),
                "TEACHING_REGISTRATION", new Policy("M3_TEACHING_REGISTRATION_V1", Duration.ofDays(3), Duration.ofDays(1)),
                "CLASS_APPROVAL", new Policy("M3_CLASS_APPROVAL_V1", Duration.ofDays(2), Duration.ofHours(12)),
                "COMMUNITY_MODERATION", new Policy("M3_COMMUNITY_MODERATION_V1", Duration.ofDays(1), Duration.ofHours(4)),
                "SUPPORT_TICKET", new Policy("M3_SUPPORT_TICKET_V1", Duration.ofDays(2), Duration.ofHours(8))
        ));
    }

    Evaluation evaluate(String source, String status, Instant createdAt, Instant businessDueAt) {
        if (isTerminal(status)) return Evaluation.notApplicable();

        Policy policy = policies.get(source);
        Instant dueAt = businessDueAt;
        Duration warning = businessDeadlineWarning;
        String policyId = null;
        if (dueAt != null) {
            policyId = source + "_BUSINESS_DEADLINE_V1";
        } else if (policy != null && createdAt != null) {
            dueAt = createdAt.plus(policy.target());
            warning = policy.warning();
            policyId = policy.id();
        }
        if (dueAt == null) return Evaluation.notApplicable();

        Instant now = clock.instant();
        if (!now.isBefore(dueAt)) {
            return new Evaluation(SlaState.OVERDUE, dueAt, 0L,
                    Math.max(0, Duration.between(dueAt, now).toMinutes()), policyId, false, null);
        }
        long remaining = Math.max(0, Duration.between(now, dueAt).toMinutes());
        SlaState state = !now.plus(warning).isBefore(dueAt) ? SlaState.DUE_SOON : SlaState.NORMAL;
        return new Evaluation(state, dueAt, remaining, 0L, policyId, false, null);
    }

    ZoneId sourceZone() {
        return sourceZone;
    }

    private boolean isTerminal(String status) {
        return status != null && TERMINAL_STATUSES.contains(status.trim().toUpperCase(Locale.ROOT));
    }

    public enum SlaState { NORMAL, DUE_SOON, OVERDUE, NOT_APPLICABLE }

    record Policy(String id, Duration target, Duration warning) { }

    public record Evaluation(SlaState state, Instant dueAt, Long remainingMinutes, Long overdueByMinutes,
                             String policyId, boolean paused, String pauseReason) {
        static Evaluation notApplicable() {
            return new Evaluation(SlaState.NOT_APPLICABLE, null, null, null, null, false, null);
        }
    }
}
