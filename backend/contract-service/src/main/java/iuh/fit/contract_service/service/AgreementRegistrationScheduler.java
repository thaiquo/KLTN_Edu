package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AgreementRegistrationScheduler {
    private static final Logger log = LoggerFactory.getLogger(AgreementRegistrationScheduler.class);

    private final ContractAgreementRepository agreementRepository;
    private final BlockchainTransactionRepository transactionRepository;
    private final AgreementRegistrationWorkflowService registrationWorkflowService;

    public AgreementRegistrationScheduler(
            ContractAgreementRepository agreementRepository,
            BlockchainTransactionRepository transactionRepository,
            AgreementRegistrationWorkflowService registrationWorkflowService) {
        this.agreementRepository = agreementRepository;
        this.transactionRepository = transactionRepository;
        this.registrationWorkflowService = registrationWorkflowService;
    }

    @Scheduled(
            initialDelayString = "${contract.registration.initial-delay-ms:10000}",
            fixedDelayString = "${contract.registration.check-interval-ms:30000}")
    public void sweepPendingRegistrations() {
        List<ContractAgreement> pendingList = agreementRepository.findByStatus(ContractAgreementStatus.PREPARING_BLOCKCHAIN);
        if (pendingList.isEmpty()) {
            return;
        }

        for (ContractAgreement agreement : pendingList) {
            String idempotencyKey = "REGISTER:" + agreement.getChainId() + ":" + agreement.getId();
            boolean alreadyExists = transactionRepository.findByIdempotencyKey(idempotencyKey).isPresent();
            if (!alreadyExists) {
                try {
                    log.info("AgreementRegistrationScheduler initiating on-chain registration intent for agreement {}", agreement.getId());
                    registrationWorkflowService.initiateRegistration(agreement.getId());
                } catch (Exception ex) {
                    log.warn("Could not initiate on-chain registration for agreement {}: {}", agreement.getId(), ex.getMessage());
                }
            }
        }
    }
}
