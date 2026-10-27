package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.AgreementTrial;
import iuh.fit.contract_service.enums.TrialStatus;
import iuh.fit.contract_service.repository.AgreementTrialRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Component
@RequiredArgsConstructor
public class TrialDeadlineScheduler {
    private static final Logger log = LoggerFactory.getLogger(TrialDeadlineScheduler.class);

    private final AgreementTrialRepository trialRepository;
    private final TrialDeadlineTransitionService transitionService;

    @Scheduled(initialDelayString = "${contract.trial-deadline.initial-delay-ms:30000}",
               fixedDelayString = "${contract.trial-deadline.delay-ms:60000}")
    public void sweepExpiredTrials() {
        // The creation flag must not disable recovery for already accepted trial rows.
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<AgreementTrial> expiredTrials = trialRepository
                .findTop50ByStatusAndTrialDeadlineLessThanEqualOrderByTrialDeadlineAsc(TrialStatus.DECISION_OPEN, now);

        for (AgreementTrial trial : expiredTrials) {
            try {
                transitionService.autoContinueTrial(trial.getAgreementId(), now);
            } catch (Exception e) {
                log.warn("Failed to auto-continue trial for agreement {}: {}", trial.getAgreementId(), e.getMessage());
            }
        }
    }
}
