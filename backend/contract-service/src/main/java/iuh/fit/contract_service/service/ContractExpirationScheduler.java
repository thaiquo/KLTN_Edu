package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Component
public class ContractExpirationScheduler {
    private static final Logger log = LoggerFactory.getLogger(ContractExpirationScheduler.class);

    private final ContractAgreementRepository agreementRepository;
    private final AgreementLifecycleWorkflowService lifecycleWorkflowService;

    public ContractExpirationScheduler(
            ContractAgreementRepository agreementRepository,
            AgreementLifecycleWorkflowService lifecycleWorkflowService) {
        this.agreementRepository = agreementRepository;
        this.lifecycleWorkflowService = lifecycleWorkflowService;
    }

    @Scheduled(
            initialDelayString = "${contract.expiration.initial-delay-ms:10000}",
            fixedDelayString = "${contract.expiration.check-interval-ms:60000}")
    @Transactional
    public void sweepExpiredAgreements() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<ContractAgreement> expiredList = agreementRepository.findByStatusAndPaymentDeadlineBefore(
                ContractAgreementStatus.WAITING_PAYMENT, now);

        if (expiredList.isEmpty()) {
            return;
        }

        log.info("Found {} agreements in WAITING_PAYMENT past deadline. Queueing on-chain expiration...",
                expiredList.size());

        for (ContractAgreement agreement : expiredList) {
            try {
                lifecycleWorkflowService.initiateExpiration(agreement.getId());
                log.info("Queued on-chain expiration for agreement {} and classroom {}",
                        agreement.getId(), agreement.getClassroomId());
            } catch (Exception ex) {
                log.error("Failed to queue expiration for agreement {}: {}", agreement.getId(), ex.getMessage(), ex);
            }
        }
    }
}
