package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractAccessControl;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.*;
import iuh.fit.contract_service.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigInteger;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminFinancialMonitoringControllerTest {

    @Mock private ContractAgreementRepository agreementRepository;
    @Mock private SessionSettlementRepository settlementRepository;
    @Mock private BlockchainTransactionRepository transactionRepository;
    @Mock private DisputeRepository disputeRepository;
    @Mock private DisputeWorkflowService disputeWorkflowService;
    @Mock private SessionSettlementWorkflowService settlementWorkflowService;
    @Mock private AgreementLifecycleWorkflowService lifecycleWorkflowService;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private ContractSignatureService signatureService;
    @Mock private AgreementFundingWorkflowService fundingWorkflowService;
    @Mock private AgreementRegistrationWorkflowService registrationWorkflowService;
    @Mock private EscrowPaymentRepository escrowPaymentRepository;
    @Mock private ProcessedEventRepository processedEventRepository;
    @Mock private ContractAcceptanceRepository acceptanceRepository;
    @Mock private LearningServiceDispatcher learningServiceDispatcher;
    @Mock private CurrentUserContext currentUserContext;
    @Mock private ContractAccessControl accessControl;
    @Mock private org.springframework.beans.factory.ObjectProvider<iuh.fit.contract_service.blockchain.EduConnectEscrowReadGateway> blockchainGateway;
    @Mock private OperationalFundingPolicy operationalFundingPolicy;

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
                blockchainGateway,
                operationalFundingPolicy
        );
    }

    @Test
    void getAdminFinancialOverview_rejectsUnauthorizedUser() {
        ContractUserPrincipal student = new ContractUserPrincipal(1L, "student@test.com", "STUDENT", List.of("STUDENT"));
        when(currentUserContext.requireCurrentUser()).thenReturn(student);
        when(accessControl.canViewTransactionsAsStaffOrAdmin(student)).thenReturn(false);

        assertThatThrownBy(() -> controller.getAdminFinancialOverview())
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only admin or staff");
    }

    @Test
    void getAdminFinancialOverview_calculatesActiveAndSettledAmountsCorrectly() {
        ContractUserPrincipal admin = new ContractUserPrincipal(99L, "admin@test.com", "ADMIN", List.of("ADMIN"));
        when(currentUserContext.requireCurrentUser()).thenReturn(admin);
        when(accessControl.canViewTransactionsAsStaffOrAdmin(admin)).thenReturn(true);

        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = new ContractAgreement();
        agreement.setId(agreementId);
        agreement.setOnchainAgreementId("0x" + "a".repeat(64));
        agreement.setClassroomId(4L);
        agreement.setClassName("Vật lý 9");
        agreement.setStudentId(10L);
        agreement.setTutorId(20L);
        agreement.setStudentWallet("0x1111111111111111111111111111111111111111");
        agreement.setTutorWallet("0x2222222222222222222222222222222222222222");
        agreement.setStatus(ContractAgreementStatus.ACTIVE);
        agreement.setTotalAmountUsdcUnits(BigInteger.valueOf(4_800_000));
        agreement.setTokenDecimals((short) 6);
        agreement.setLegacyExcluded(false);
        agreement.setPlatformWallet("0x10dd719B6a13e9d275990d706C2640ab6F1CA28e");
        agreement.setEscrowContractAddress("0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3");
        agreement.setChainId(11155111L);

        when(agreementRepository.findAll()).thenReturn(List.of(agreement));
        when(operationalFundingPolicy.isFunded(agreement)).thenReturn(true);

        SessionSettlement s1 = SessionSettlement.create(
                agreement, 1L, "0xsession1", SettlementOutcome.BOTH_PRESENT, BigInteger.valueOf(600_000), "0xevidence"
        );
        s1.recordDistribution(BigInteger.valueOf(510_000), BigInteger.valueOf(90_000), BigInteger.ZERO);
        s1.markSettled("0xfinalize");

        when(settlementRepository.findByAgreementId(agreementId)).thenReturn(List.of(s1));

        ResponseEntity<ContractManagementController.AdminFinancialOverviewDto> response = controller.getAdminFinancialOverview();
        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        ContractManagementController.AdminFinancialOverviewDto dto = response.getBody();
        assertThat(dto).isNotNull();
        assertThat(dto.totalEscrowFundedUsdc()).isEqualTo(4.8);
        assertThat(dto.totalTutorPaidUsdc()).isEqualTo(0.51);
        assertThat(dto.totalPlatformFeeUsdc()).isEqualTo(0.09);
        assertThat(dto.totalEscrowLockedUsdc()).isEqualTo(4.2);
        assertThat(dto.totalActiveAgreements()).isEqualTo(1);
        assertThat(dto.totalSettledSessions()).isEqualTo(1);
    }

    @Test
    void listAdminSettlements_returnsPagedSettlements() {
        ContractUserPrincipal admin = new ContractUserPrincipal(99L, "admin@test.com", "ADMIN", List.of("ADMIN"));
        when(currentUserContext.requireCurrentUser()).thenReturn(admin);
        when(accessControl.canViewTransactionsAsStaffOrAdmin(admin)).thenReturn(true);

        ContractAgreement agreement = new ContractAgreement();
        agreement.setId(UUID.randomUUID());
        agreement.setClassName("Vật lý 9");
        agreement.setClassroomId(4L);
        agreement.setStudentName("Học viên Nguyễn Văn A");
        agreement.setTutorName("Gia sư Trần Thị B");
        agreement.setTokenDecimals((short) 6);

        SessionSettlement s1 = SessionSettlement.create(
                agreement, 1L, "0xsession1", SettlementOutcome.BOTH_PRESENT, BigInteger.valueOf(600_000), "0xevidence"
        );
        s1.recordDistribution(BigInteger.valueOf(510_000), BigInteger.valueOf(90_000), BigInteger.ZERO);
        s1.markSettled("0xfinalize");

        when(settlementRepository.findAll()).thenReturn(List.of(s1));

        var response = controller.listAdminSettlements("ALL", PageRequest.of(0, 10));
        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getTotalElements()).isEqualTo(1);
        assertThat(response.getBody().getContent().get(0).tutorAmountUsdc()).isEqualTo(0.51);
        assertThat(response.getBody().getContent().get(0).platformAmountUsdc()).isEqualTo(0.09);
        assertThat(response.getBody().getContent().get(0).finalizeTxHash()).isEqualTo("0xfinalize");
    }
}
