package iuh.fit.contract_service.service;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;

@Component
public class TutorAbsenceDeadlinePolicy {

    public static final Duration MAX_EVIDENCE_WINDOW = Duration.ofHours(24);
    public static final Duration ADMIN_REVIEW_BUFFER = Duration.ofHours(12);

    public record Deadlines(
            OffsetDateTime responseDeadline,
            OffsetDateTime decisionDeadline,
            boolean insufficientReviewWindow
    ) {}

    /**
     * Calculates the two-deadline SLA for tutor absence governance:
     * - T0: holdConfirmedAt (when hold was successfully synced)
     * - S: nextSessionStartAt (start of session N+1)
     *
     * Rules:
     * - Decision deadline = S
     * - Buffer evidence deadline = S - 12h
     * - Max evidence deadline = T0 + 24h
     * - If bufferEvidence <= T0 (i.e. S - 12h <= T0), insufficientReviewWindow = true
     * - Otherwise responseDeadline = min(T0 + 24h, S - 12h)
     */
    public Deadlines calculateDeadlines(OffsetDateTime holdConfirmedAt, OffsetDateTime nextSessionStartAt) {
        if (holdConfirmedAt == null) {
            throw new IllegalArgumentException("holdConfirmedAt cannot be null");
        }
        if (nextSessionStartAt == null) {
            throw new IllegalArgumentException("nextSessionStartAt cannot be null");
        }

        OffsetDateTime decisionDeadline = nextSessionStartAt;
        OffsetDateTime bufferEvidence = nextSessionStartAt.minus(ADMIN_REVIEW_BUFFER);
        OffsetDateTime maxEvidence = holdConfirmedAt.plus(MAX_EVIDENCE_WINDOW);

        if (!bufferEvidence.isAfter(holdConfirmedAt)) {
            // S - 12h <= T0
            return new Deadlines(holdConfirmedAt, decisionDeadline, true);
        }

        OffsetDateTime responseDeadline = bufferEvidence.isBefore(maxEvidence) ? bufferEvidence : maxEvidence;
        return new Deadlines(responseDeadline, decisionDeadline, false);
    }

    public boolean isResponseExpired(OffsetDateTime responseDeadline, OffsetDateTime now) {
        if (responseDeadline == null || now == null) return false;
        return !now.isBefore(responseDeadline);
    }

    public boolean isDecisionExpired(OffsetDateTime decisionDeadline, OffsetDateTime now) {
        if (decisionDeadline == null || now == null) return false;
        return !now.isBefore(decisionDeadline);
    }
}
