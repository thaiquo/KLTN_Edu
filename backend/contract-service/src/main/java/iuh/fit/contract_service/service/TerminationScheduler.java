package iuh.fit.contract_service.service;

import iuh.fit.contract_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;

@Component @RequiredArgsConstructor
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "termination.enabled", havingValue = "true", matchIfMissing = true)
public class TerminationScheduler {
    private final TerminationCaseRepository cases;
    private final TerminationItemRepository items;
    private final TerminationProcessor processor;
    private final TerminationSignals signals;
    private final TerminationService service;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(TerminationScheduler.class);
    @Scheduled(initialDelayString = "${termination.initial-delay-ms:15000}", fixedDelayString = "${termination.delay-ms:30000}")
    public void tick() {
        try { signals.detect(); }
        catch (Exception e) { log.warn("Termination signal scan failed: {}", e.getMessage()); }
        synchronize("HOLD_PENDING");
        synchronize("RELEASE_PENDING");
        expireAbsenceCases();
        for (var c : cases.findTop50ByStatusOrderByUpdatedAtAsc("APPROVED")) {
            for (var item : items.findByCaseIdOrderByAgreementId(c.getId())) {
                if ("COMPLETED".equals(item.getStatus())) continue;
                try { processor.process(item.getAgreementId()); }
                catch (Exception e) { processor.failure(item.getAgreementId(), e.getMessage()); }
            }
            try { processor.finish(c.getId()); }
            catch (Exception e) { processor.caseFailure(c.getId(), e.getMessage()); }
        }
    }

    private void expireAbsenceCases() {
        java.time.OffsetDateTime now = java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC);
        for (var id : cases.findExpiredResponseCandidateIds(now)) {
            try { service.processAbsenceExpiry(id, "NO_TUTOR_RESPONSE"); }
            catch (Exception e) { log.warn("Failed to expire tutor response for case {}: {}", id, e.getMessage()); }
        }
        for (var id : cases.findExpiredDecisionCandidateIds(now)) {
            try { service.processAbsenceExpiry(id, "NO_ADMIN_DECISION"); }
            catch (Exception e) { log.warn("Failed to expire admin decision for case {}: {}", id, e.getMessage()); }
        }
        for (var id : cases.findExpiredReleaseCandidateIds(now)) {
            try { service.processAbsenceExpiry(id, "RELEASE_TIMEOUT"); }
            catch (Exception e) { log.warn("Failed to expire release for case {}: {}", id, e.getMessage()); }
        }
        for (var id : cases.findExpiredHoldSyncCandidateIds(now)) {
            try { service.processAbsenceExpiry(id, "HOLD_SYNC_TIMEOUT"); }
            catch (Exception e) { log.warn("Failed to expire hold sync for case {}: {}", id, e.getMessage()); }
        }
    }

    private void synchronize(String status) {
        for (var c : cases.findTop50ByStatusOrderByUpdatedAtAsc(status)) {
            try { service.retryLearningSynchronization(c.getId()); }
            catch (Exception e) { log.warn("Termination {} synchronization failed: {}", c.getId(), e.getMessage()); }
        }
    }
}
