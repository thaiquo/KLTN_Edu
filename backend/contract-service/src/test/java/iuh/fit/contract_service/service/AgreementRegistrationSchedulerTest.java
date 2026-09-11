package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgreementRegistrationSchedulerTest {

    @Mock
    private ContractAgreementRepository agreements;
    @Mock
    private BlockchainTransactionRepository transactions;
    @Mock
    private AgreementRegistrationWorkflowService workflow;

    @Test
    void createsMissingRegistrationIntentForPreparingAgreement() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = preparingAgreement(agreementId);
        when(agreements.findByStatus(ContractAgreementStatus.PREPARING_BLOCKCHAIN))
                .thenReturn(List.of(agreement));
        when(transactions.findByIdempotencyKey("REGISTER:11155111:" + agreementId))
                .thenReturn(Optional.empty());

        new AgreementRegistrationScheduler(agreements, transactions, workflow)
                .sweepPendingRegistrations();

        verify(workflow).initiateRegistration(agreementId);
    }

    @Test
    void doesNotDuplicateExistingRegistrationIntent() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = preparingAgreement(agreementId);
        when(agreements.findByStatus(ContractAgreementStatus.PREPARING_BLOCKCHAIN))
                .thenReturn(List.of(agreement));
        when(transactions.findByIdempotencyKey("REGISTER:11155111:" + agreementId))
                .thenReturn(Optional.of(org.mockito.Mockito.mock(BlockchainTransaction.class)));

        new AgreementRegistrationScheduler(agreements, transactions, workflow)
                .sweepPendingRegistrations();

        verify(workflow, never()).initiateRegistration(agreementId);
    }

    private static ContractAgreement preparingAgreement(UUID id) {
        return ContractAgreement.builder()
                .id(id)
                .chainId(11155111L)
                .status(ContractAgreementStatus.PREPARING_BLOCKCHAIN)
                .build();
    }
}
