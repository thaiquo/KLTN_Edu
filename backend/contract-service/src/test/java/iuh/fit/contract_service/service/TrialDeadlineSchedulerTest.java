package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.AgreementTrial;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.TrialDecisionSource;
import iuh.fit.contract_service.enums.TrialStatus;
import iuh.fit.contract_service.repository.AgreementTrialRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrialDeadlineSchedulerTest {

    @Mock AgreementTrialRepository trialRepository;
    @Mock ContractAgreementRepository agreementRepository;
    @Mock NotificationDispatcher notifications;
    @Mock TrialDeadlineTransitionService transitionService;

    @Test
    void sweepExpiredTrialsDelegatesRecoveryWithoutConsultingCreationFlag() {
        UUID agreementId = UUID.randomUUID();
        var trial = new AgreementTrial();
        trial.setAgreementId(agreementId);
        trial.setStatus(TrialStatus.DECISION_OPEN);
        when(trialRepository.findTop50ByStatusAndTrialDeadlineLessThanEqualOrderByTrialDeadlineAsc(
                eq(TrialStatus.DECISION_OPEN), any())).thenReturn(List.of(trial));

        new TrialDeadlineScheduler(trialRepository, transitionService).sweepExpiredTrials();

        verify(transitionService).autoContinueTrial(eq(agreementId), any());
    }

    @Test
    void transitionAutoContinuesExpiredTrial() {
        UUID agreementId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        var trial = new AgreementTrial();
        trial.setAgreementId(agreementId);
        trial.setStatus(TrialStatus.DECISION_OPEN);
        trial.setTrialDeadline(now.minusHours(1));
        var agreement = ContractAgreement.builder()
                .id(agreementId).studentEmail("student@test.vn").studentId(2L).build();
        when(agreementRepository.lockById(agreementId)).thenReturn(Optional.of(agreement));
        when(trialRepository.lockByAgreementId(agreementId)).thenReturn(Optional.of(trial));

        var transition = new TrialDeadlineTransitionService(trialRepository, agreementRepository, notifications);
        transition.autoContinueTrial(agreementId, now);

        assertThat(trial.getStatus()).isEqualTo(TrialStatus.CONTINUED);
        assertThat(trial.getDecisionSource()).isEqualTo(TrialDecisionSource.AUTO_DEADLINE);
        verify(trialRepository).save(trial);
        verify(notifications).sendAsync(eq("student@test.vn"), eq(2L), any(), any(),
                eq("TRIAL_CONTINUED"), any(), any());
    }

    @Test
    void transitionSkipsIfBeforeDeadline() {
        UUID agreementId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        var trial = new AgreementTrial();
        trial.setAgreementId(agreementId);
        trial.setStatus(TrialStatus.DECISION_OPEN);
        trial.setTrialDeadline(now.plusHours(2));
        var agreement = ContractAgreement.builder().id(agreementId).build();
        when(agreementRepository.lockById(agreementId)).thenReturn(Optional.of(agreement));
        when(trialRepository.lockByAgreementId(agreementId)).thenReturn(Optional.of(trial));

        new TrialDeadlineTransitionService(trialRepository, agreementRepository, notifications)
                .autoContinueTrial(agreementId, now);

        assertThat(trial.getStatus()).isEqualTo(TrialStatus.DECISION_OPEN);
        verify(trialRepository, never()).save(any());
    }
}
