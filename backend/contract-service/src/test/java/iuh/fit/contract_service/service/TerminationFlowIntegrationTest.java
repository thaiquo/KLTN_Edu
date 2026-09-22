package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.OffsetDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:termination_flow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "termination.enabled=false"})
@Transactional
class TerminationFlowIntegrationTest {
    @Autowired TerminationService service;
    @Autowired TerminationProcessor processor;
    @Autowired ContractAgreementRepository agreements;
    @Autowired TerminationItemRepository items;
    @Autowired TerminationCaseRepository cases;
    @Autowired BlockchainTransactionRepository transactions;
    @Autowired ProcessedEventRepository events;
    @Autowired AgreementLifecycleWorkflowService lifecycle;
    @MockitoBean TerminationLearningClient learning;
    @MockitoBean NotificationDispatcher notifications;
    @MockitoBean OperationalFundingPolicy funding;
    @MockitoBean Eip712VerificationService verificationService;
    final String student = "0x" + "1".repeat(40);
    final String escrow = "0x" + "4".repeat(40);

    ContractAgreement agreement(long studentId) {
        var now = OffsetDateTime.now();
        return agreements.saveAndFlush(ContractAgreement.builder().id(UUID.randomUUID()).classroomId(9999L)
                .studentId(studentId).tutorId(3L).studentEmail("s" + studentId + "@test.vn").tutorEmail("t@test.vn")
                .studentWallet(student).tutorWallet("0x" + "2".repeat(40)).platformWallet("0x" + "3".repeat(40))
                .classroomReviewerEmail("staff@test.vn").chainId(31337L).escrowContractAddress(escrow)
                .onchainAgreementId("0x" + String.format("%064x", studentId)).tokenSymbol("USDC").tokenDecimals((short)6)
                .termsJson("{}").termsHash("0x" + "a".repeat(64)).contractVersion(1)
                .totalPriceVnd(BigDecimal.valueOf(100000)).vndPerUsdc(BigDecimal.valueOf(25000))
                .totalAmountUsdcUnits(BigInteger.valueOf(4000000)).pricePerSessionUsdcUnits(BigInteger.valueOf(1000000))
                .totalSessions(4).status(ContractAgreementStatus.ACTIVE).createdAt(now).updatedAt(now).build());
    }
    ContractUserPrincipal user(long id, String email, String role) { return new ContractUserPrincipal(id, email, role, List.of(role)); }
    UUID approve(ContractAgreement a, boolean wholeClass) {
        when(verificationService.verifyTerminationSignature(any(), any(), any(), any(), anyBoolean(), anyLong(), anyLong(), any()))
                .thenReturn(true);
        when(learning.send(9999L, a.getStudentId(), a.getId(), wholeClass, "HOLD"))
                .thenReturn(new TerminationLearningClient.Snapshot(0, List.of()));
        var requester = wholeClass
                ? user(3, "t@test.vn", "TUTOR")
                : user(a.getStudentId(), a.getStudentEmail(), "STUDENT");
        var wallet = wholeClass ? a.getTutorWallet() : a.getStudentWallet();
        var request = service.request(a.getId(), wholeClass, "Cannot continue", "0xsig-" + a.getId(), wallet, System.currentTimeMillis() / 1000L, requester);
        service.act(request.request().getId(), "RECOMMEND", "Evidence reviewed", user(4, "staff@test.vn", "STAFF"));
        service.act(request.request().getId(), "APPROVE", "Approved", user(1, "admin@test.vn", "ADMIN"));
        return request.request().getId();
    }
    @Test void individualTerminationPersistsOneIntentAndWaitsForBothConfirmedEvents() {
        var a = agreement(2); var b = agreement(5);
        UUID caseId = approve(a, false);
        assertThat(items.findByCaseIdOrderByAgreementId(caseId)).hasSize(1);
        assertThat(b.getTerminationCutoffSession()).isNull();
        when(learning.send(9999L, 2L, a.getId(), false, "FREEZE"))
                .thenReturn(new TerminationLearningClient.Snapshot(0, List.of()));
        processor.process(a.getId()); processor.process(a.getId());
        assertThat(transactions.count()).isEqualTo(1);
        assertThat(agreements.findById(a.getId()).orElseThrow().getStatus()).isEqualTo(ContractAgreementStatus.ACTIVE);
        String tx = "0x" + "b".repeat(64);
        var log = new BlockchainLog(escrow, List.of(), "0x", 100, "0xblock", tx, 0);
        var cancelled = ProcessedEvent.blockchainLog(31337, escrow, log, "AGREEMENT_CANCELLED",
                "{\"agreementId\":\"" + a.getOnchainAgreementId() + "\",\"attributes\":{\"reasonHash\":\"0xreason\"}}", OffsetDateTime.now());
        lifecycle.processCancelledEvent(cancelled);
        processor.process(a.getId());
        assertThat(items.findById(a.getId()).orElseThrow().getStatus()).isEqualTo("WAITING_REFUND_EVENT");
        events.saveAndFlush(ProcessedEvent.blockchainLog(31337, escrow,
                new BlockchainLog(escrow, List.of(), "0x", 100, "0xblock", tx, 1), "UNUSED_AMOUNT_REFUNDED",
                "{\"agreementId\":\"" + a.getOnchainAgreementId() + "\",\"attributes\":{\"student\":\"" + student
                        + "\",\"amount\":\"4000000\"}}", OffsetDateTime.now()));
        processor.process(a.getId()); processor.finish(caseId);
        assertThat(cases.findById(caseId).orElseThrow().getStatus()).isEqualTo("COMPLETED");
        assertThat(items.findById(a.getId()).orElseThrow().getRefundedUnits()).isEqualTo(BigInteger.valueOf(4000000));
        verify(learning).send(9999L, 2L, a.getId(), false, "CLOSE");
        verify(learning, never()).send(eq(9999L), eq(5L), any(), anyBoolean(), any());
    }
    @Test void classTerminationSnapshotsEveryAgreementAndBlocksNewCreation() {
        var a = agreement(2); var b = agreement(5);
        UUID caseId = approve(a, true);
        assertThat(items.findByCaseIdOrderByAgreementId(caseId)).hasSize(2);
        assertThat(a.getTerminationCutoffSession()).isEqualTo(0);
        assertThat(b.getTerminationCutoffSession()).isEqualTo(0);
        assertThatThrownBy(() -> service.requireClassCanCreate(9999L)).hasMessageContaining("409");
    }
}
