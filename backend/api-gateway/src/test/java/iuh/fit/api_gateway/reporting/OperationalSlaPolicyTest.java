package iuh.fit.api_gateway.reporting;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

class OperationalSlaPolicyTest {
    private static final Instant NOW = Instant.parse("2026-11-17T12:00:00Z");
    private final OperationalSlaPolicy policy = OperationalSlaPolicy.defaults(Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void derivesNormalDueSoonAndOverdueFromCentralPolicyBoundaries() {
        var normal = policy.evaluate("TUTOR_APPLICATION", "PENDING", NOW.minus(Duration.ofHours(12)), null);
        var dueSoon = policy.evaluate("TUTOR_APPLICATION", "PENDING", NOW.minus(Duration.ofHours(60)), null);
        var overdue = policy.evaluate("TUTOR_APPLICATION", "PENDING", NOW.minus(Duration.ofHours(80)), null);

        assertEquals(OperationalSlaPolicy.SlaState.NORMAL, normal.state());
        assertEquals(OperationalSlaPolicy.SlaState.DUE_SOON, dueSoon.state());
        assertEquals(OperationalSlaPolicy.SlaState.OVERDUE, overdue.state());
        assertEquals("M3_TUTOR_APPLICATION_V1", dueSoon.policyId());
        assertFalse(overdue.paused());
    }

    @Test
    void realBusinessDeadlineWinsAndUsesDedicatedPolicyIdentity() {
        Instant ownerDeadline = NOW.plus(Duration.ofHours(2));
        var result = policy.evaluate("DISPUTE", "OPEN", NOW.minus(Duration.ofDays(3)), ownerDeadline);

        assertEquals(OperationalSlaPolicy.SlaState.DUE_SOON, result.state());
        assertEquals(ownerDeadline, result.dueAt());
        assertEquals("DISPUTE_BUSINESS_DEADLINE_V1", result.policyId());
    }

    @Test
    void noDeadlineOrPolicyIsNotApplicableAndDoesNotInventPause() {
        OperationalSlaPolicy noPolicies = new OperationalSlaPolicy(
                Clock.fixed(NOW, ZoneOffset.UTC), ZoneId.of("Asia/Ho_Chi_Minh"),
                Duration.ofHours(6), Map.of());
        var result = noPolicies.evaluate("UNKNOWN", "OPEN", NOW, null);

        assertEquals(OperationalSlaPolicy.SlaState.NOT_APPLICABLE, result.state());
        assertNull(result.dueAt());
        assertFalse(result.paused());
        assertNull(result.pauseReason());
    }

    @Test
    void terminalWorkItemIsNotApplicableEvenWhenItHadADeadline() {
        var result = policy.evaluate("DISPUTE", "RESOLVED", NOW.minus(Duration.ofDays(2)), NOW.minusSeconds(1));
        assertEquals(OperationalSlaPolicy.SlaState.NOT_APPLICABLE, result.state());
        assertNull(result.dueAt());
    }
}
