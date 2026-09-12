package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractAccessControl;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.repository.ContractAcceptanceRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import iuh.fit.contract_service.service.AgreementFundingWorkflowService;
import iuh.fit.contract_service.service.AgreementLifecycleWorkflowService;
import iuh.fit.contract_service.service.ContractSignatureService;
import iuh.fit.contract_service.service.DisputeWorkflowService;
import iuh.fit.contract_service.service.LearningServiceDispatcher;
import iuh.fit.contract_service.service.NotificationDispatcher;
import iuh.fit.contract_service.service.SessionSettlementWorkflowService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractManagementControllerPaymentTest {

    @Mock
    private ContractAgreementRepository agreementRepository;
    @Mock
    private SessionSettlementRepository settlementRepository;
    @Mock
    private BlockchainTransactionRepository transactionRepository;
    @Mock
    private DisputeRepository disputeRepository;
    @Mock
    private DisputeWorkflowService disputeWorkflowService;
    @Mock
    private SessionSettlementWorkflowService settlementWorkflowService;
    @Mock
    private AgreementLifecycleWorkflowService lifecycleWorkflowService;
    @Mock
    private NotificationDispatcher notificationDispatcher;
    @Mock
    private ContractSignatureService signatureService;
    @Mock
    private AgreementFundingWorkflowService fundingWorkflowService;
    @Mock
    private iuh.fit.contract_service.service.AgreementRegistrationWorkflowService registrationWorkflowService;
    @Mock
    private EscrowPaymentRepository escrowPaymentRepository;
    @Mock
    private ProcessedEventRepository processedEventRepository;
    @Mock
    private ContractAcceptanceRepository acceptanceRepository;
    @Mock
    private LearningServiceDispatcher learningServiceDispatcher;
    @Mock
    private CurrentUserContext currentUserContext;
    @Mock
    private ContractAccessControl accessControl;
    @Mock
    private org.springframework.beans.factory.ObjectProvider<iuh.fit.contract_service.blockchain.EduConnectEscrowReadGateway> blockchainGateway;

    private ContractManagementController controller;

    @BeforeEach
    void setUp() {
        controller = new ContractManagementController(
                agreementRepository,
                settlementRepository,
                transactionRepository,
                disputeRepository,
                disputeWorkflowService,
                settlementWorkflowService,
                lifecycleWorkflowService,
                notificationDispatcher,
                signatureService,
                fundingWorkflowService,
                registrationWorkflowService,
                escrowPaymentRepository,
                processedEventRepository,
                acceptanceRepository,
                learningServiceDispatcher,
                currentUserContext,
                accessControl,
                blockchainGateway, new iuh.fit.contract_service.service.OperationalFundingPolicy(
                        agreementRepository, escrowPaymentRepository, processedEventRepository,
                        new tools.jackson.databind.ObjectMapper()));
    }

    @Test
    void listsEmptyAgreementsForAuthenticatedStudentWithoutMutatingAccessControlResult() {
        var user = new ContractUserPrincipal(1L, "student@example.com", "STUDENT", List.of("STUDENT"));
        when(currentUserContext.requireCurrentUser()).thenReturn(user);
        when(agreementRepository.findAll()).thenReturn(List.of());
        when(accessControl.filterAgreements(List.of(), user))
                .thenReturn(new ContractAccessControl().filterAgreements(List.of(), user));
        var response = controller.listAgreements(null, org.springframework.data.domain.PageRequest.of(0, 50));
        assertThat(response.getBody().getTotalElements()).isZero();
    }

    @Test
    void listsEmptyDisputesForAuthenticatedTutorWithoutMutatingAccessControlResult() {
        var user = new ContractUserPrincipal(2L, "tutor@example.com", "TUTOR", List.of("TUTOR"));
        when(currentUserContext.requireCurrentUser()).thenReturn(user);
        when(disputeRepository.findAll()).thenReturn(List.of());
        when(accessControl.filterDisputes(List.of(), user))
                .thenReturn(new ContractAccessControl().filterDisputes(List.of(), user));
        var response = controller.listDisputes(null, org.springframework.data.domain.PageRequest.of(0, 50));
        assertThat(response.getBody().getTotalElements()).isZero();
    }

    @Test
    void paymentSubmittedBeforeWaitingPaymentReturnsConflict() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = agreement(agreementId, ContractAgreementStatus.PREPARING_BLOCKCHAIN);
        when(currentUserContext.requireCurrentUser())
                .thenReturn(new ContractUserPrincipal(1L, "student@example.com", "STUDENT", List.of("STUDENT")));
        when(agreementRepository.findById(agreementId)).thenReturn(Optional.of(agreement));

        var response = controller.submitPayment(agreementId, Map.of("txHash", "0x" + "a".repeat(64)));

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        verify(fundingWorkflowService, never()).recordPaymentSubmission(any(), any());
    }

    @Test
    void paymentSubmittedByTutorReturnsForbidden() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = agreement(agreementId, ContractAgreementStatus.WAITING_PAYMENT);
        ContractUserPrincipal tutor = new ContractUserPrincipal(2L, "tutor@example.com", "TUTOR", List.of("TUTOR"));
        when(currentUserContext.requireCurrentUser()).thenReturn(tutor);
        when(agreementRepository.findById(agreementId)).thenReturn(Optional.of(agreement));
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the agreement student can submit payment."))
                .when(accessControl).requireCanSubmitPayment(agreement, tutor);

        var response = controller.submitPayment(agreementId, Map.of("txHash", "0x" + "b".repeat(64)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verify(fundingWorkflowService, never()).recordPaymentSubmission(any(), any());
    }

    @Test
    void paymentSubmittedAfterFundingEventDelegatesToWorkflowForIdempotentDecision() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = agreement(agreementId, ContractAgreementStatus.ACTIVE);
        when(currentUserContext.requireCurrentUser())
                .thenReturn(new ContractUserPrincipal(1L, "student@example.com", "STUDENT", List.of("STUDENT")));
        when(agreementRepository.findById(agreementId)).thenReturn(Optional.of(agreement));
        when(fundingWorkflowService.recordPaymentSubmission(agreementId, "0x" + "c".repeat(64)))
                .thenReturn(agreement);

        var response = controller.submitPayment(agreementId, Map.of("txHash", "0x" + "c".repeat(64)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(fundingWorkflowService).recordPaymentSubmission(agreementId, "0x" + "c".repeat(64));
    }

    @Test
    void legacyActiveAgreementCannotBeCancelledOrRefunded() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = agreement(agreementId, ContractAgreementStatus.ACTIVE);
        ContractUserPrincipal admin = new ContractUserPrincipal(9L, "admin@example.com", "ADMIN", List.of("ADMIN"));
        when(currentUserContext.requireCurrentUser()).thenReturn(admin);
        when(agreementRepository.findById(agreementId)).thenReturn(Optional.of(agreement));
        when(escrowPaymentRepository.findByAgreementId(agreementId)).thenReturn(Optional.empty());

        var response = controller.cancelAgreement(
                agreementId,
                new ContractManagementController.LifecycleReasonRequest("legacy check"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(lifecycleWorkflowService, never()).initiateCancellation(any(), any());
    }

    @Test
    void legacyActiveAgreementCannotCreateSessionSettlement() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = agreement(agreementId, ContractAgreementStatus.ACTIVE);
        ContractUserPrincipal admin = new ContractUserPrincipal(9L, "admin@example.com", "ADMIN", List.of("ADMIN"));
        when(currentUserContext.requireCurrentUser()).thenReturn(admin);
        when(agreementRepository.findById(agreementId)).thenReturn(Optional.of(agreement));
        when(escrowPaymentRepository.findByAgreementId(agreementId)).thenReturn(Optional.empty());

        var response = controller.proposeSessionSettlement(
                agreementId,
                101L,
                new ContractManagementController.LegacyProposeSettlementRequest("BOTH_PRESENT", null));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(settlementWorkflowService, never()).initiateSessionProposal(any(), any(), any(), any());
    }

    private ContractAgreement agreement(UUID id, ContractAgreementStatus status) {
        return ContractAgreement.builder()
                .id(id)
                .studentId(1L)
                .chainId(31337L)
                .studentEmail("student@example.com")
                .tutorId(2L)
                .tutorEmail("tutor@example.com")
                .tokenDecimals((short) 6)
                .totalSessions(8)
                .totalAmountUsdcUnits(BigInteger.valueOf(4_800_000))
                .pricePerSessionUsdcUnits(BigInteger.valueOf(600_000))
                .status(status)
                .build();
    }
}
