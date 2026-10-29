package iuh.fit.contract_service.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TutorAbsenceDeadlinePolicyTest {

    private final TutorAbsenceDeadlinePolicy policy = new TutorAbsenceDeadlinePolicy();

    @Test
    @DisplayName("Ample window: T0 + 24h < S - 12h -> Response deadline is capped at T0 + 24h")
    void ampleWindowResponseDeadlineCappedAt24Hours() {
        OffsetDateTime t0 = OffsetDateTime.of(2026, 10, 20, 10, 0, 0, 0, ZoneOffset.UTC);
        // S is 4 days later (96 hours): S - 12h = 84h > 24h
        OffsetDateTime s = t0.plusDays(4);

        var deadlines = policy.calculateDeadlines(t0, s);

        assertThat(deadlines.insufficientReviewWindow()).isFalse();
        assertThat(deadlines.decisionDeadline()).isEqualTo(s);
        assertThat(deadlines.responseDeadline()).isEqualTo(t0.plusHours(24));
    }

    @Test
    @DisplayName("Constrained window: S - 12h < T0 + 24h -> Response deadline is S - 12h")
    void constrainedWindowResponseDeadlineBufferBeforeNextSession() {
        OffsetDateTime t0 = OffsetDateTime.of(2026, 10, 20, 10, 0, 0, 0, ZoneOffset.UTC);
        // S is 30 hours after T0: S - 12h = 18h (< 24h, but > 0h from T0)
        OffsetDateTime s = t0.plusHours(30);

        var deadlines = policy.calculateDeadlines(t0, s);

        assertThat(deadlines.insufficientReviewWindow()).isFalse();
        assertThat(deadlines.decisionDeadline()).isEqualTo(s);
        assertThat(deadlines.responseDeadline()).isEqualTo(s.minusHours(12));
    }

    @Test
    @DisplayName("Insufficient review window: S - 12h == T0 -> insufficientReviewWindow is true")
    void boundaryExactly12HoursBeforeSessionIsInsufficient() {
        OffsetDateTime t0 = OffsetDateTime.of(2026, 10, 20, 10, 0, 0, 0, ZoneOffset.UTC);
        // S is exactly 12h after T0 -> S - 12h == T0
        OffsetDateTime s = t0.plusHours(12);

        var deadlines = policy.calculateDeadlines(t0, s);

        assertThat(deadlines.insufficientReviewWindow()).isTrue();
        assertThat(deadlines.decisionDeadline()).isEqualTo(s);
        assertThat(deadlines.responseDeadline()).isEqualTo(t0);
    }

    @Test
    @DisplayName("Insufficient review window: S - 12h < T0 (e.g. S is 6h away) -> insufficientReviewWindow is true")
    void shortNoticeSessionIsInsufficient() {
        OffsetDateTime t0 = OffsetDateTime.of(2026, 10, 20, 10, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime s = t0.plusHours(6);

        var deadlines = policy.calculateDeadlines(t0, s);

        assertThat(deadlines.insufficientReviewWindow()).isTrue();
        assertThat(deadlines.decisionDeadline()).isEqualTo(s);
    }

    @Test
    @DisplayName("Boundary checks for expiry: now strictly before deadline is not expired, equal or after is expired")
    void expiryBoundariesStrict() {
        OffsetDateTime deadline = OffsetDateTime.of(2026, 10, 20, 12, 0, 0, 0, ZoneOffset.UTC);

        // 1 nano before -> NOT expired
        assertThat(policy.isResponseExpired(deadline, deadline.minusNanos(1))).isFalse();
        assertThat(policy.isDecisionExpired(deadline, deadline.minusNanos(1))).isFalse();

        // exact deadline -> EXPIRED
        assertThat(policy.isResponseExpired(deadline, deadline)).isTrue();
        assertThat(policy.isDecisionExpired(deadline, deadline)).isTrue();

        // after deadline -> EXPIRED
        assertThat(policy.isResponseExpired(deadline, deadline.plusSeconds(1))).isTrue();
        assertThat(policy.isDecisionExpired(deadline, deadline.plusSeconds(1))).isTrue();
    }

    @Test
    @DisplayName("Timezone invariance: UTC vs Asia/Ho_Chi_Minh offset comparisons")
    void timezoneInvariance() {
        ZoneOffset vnOffset = ZoneOffset.ofHours(7);
        OffsetDateTime t0Vn = OffsetDateTime.of(2026, 10, 20, 17, 0, 0, 0, vnOffset); // 10:00 UTC
        OffsetDateTime sUtc = OffsetDateTime.of(2026, 10, 21, 22, 0, 0, 0, ZoneOffset.UTC); // 36 hours later

        var deadlines = policy.calculateDeadlines(t0Vn, sUtc);

        assertThat(deadlines.insufficientReviewWindow()).isFalse();
        // S - 12h = 2026-10-21T10:00:00Z (24h after T0)
        // T0 + 24h = 2026-10-21T10:00:00Z
        assertThat(deadlines.responseDeadline().isEqual(t0Vn.plusHours(24))).isTrue();
    }

    @Test
    @DisplayName("Null arguments fail fast")
    void nullArgumentsFailFast() {
        OffsetDateTime now = OffsetDateTime.now();
        assertThatThrownBy(() -> policy.calculateDeadlines(null, now))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> policy.calculateDeadlines(now, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
