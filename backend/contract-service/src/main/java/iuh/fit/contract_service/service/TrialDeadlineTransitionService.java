package iuh.fit.contract_service.service;

import iuh.fit.contract_service.enums.TrialDecisionSource;
import iuh.fit.contract_service.enums.TrialStatus;
import iuh.fit.contract_service.repository.AgreementTrialRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TrialDeadlineTransitionService {
    private static final Logger log = LoggerFactory.getLogger(TrialDeadlineTransitionService.class);

    private final AgreementTrialRepository trialRepository;
    private final ContractAgreementRepository agreementRepository;
    private final NotificationDispatcher notifications;

    @Transactional
    public void autoContinueTrial(UUID agreementId, OffsetDateTime now) {
        var agreementOpt = agreementRepository.lockById(agreementId);
        if (agreementOpt.isEmpty()) return;
        var trialOpt = trialRepository.lockByAgreementId(agreementId);
        if (trialOpt.isEmpty()) return;

        var trial = trialOpt.get();
        if (trial.getStatus() != TrialStatus.DECISION_OPEN) return;
        if (now.isBefore(trial.getTrialDeadline())) return;

        trial.setStatus(TrialStatus.CONTINUED);
        trial.setDecisionSource(TrialDecisionSource.AUTO_DEADLINE);
        trial.setDecisionAt(now);
        trial.setUpdatedAt(now);
        trialRepository.save(trial);

        var agreement = agreementOpt.get();
        notifications.sendAsync(
                agreement.getStudentEmail(),
                agreement.getStudentId(),
                "Hợp đồng tiếp tục chính thức",
                "Thời hạn trải nghiệm đã kết thúc. Hợp đồng của bạn đã tự động chuyển sang giai đoạn học chính thức.",
                "TRIAL_CONTINUED",
                "CONTRACT_AGREEMENT",
                agreement.getId().toString()
        );
        log.info("Trial for agreement {} auto-continued after deadline {}", agreementId, trial.getTrialDeadline());
    }
}
