package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.security.*;
import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import java.util.*;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TerminationServiceTest {
    @Mock TerminationCaseRepository cases;
    @Mock TerminationItemRepository items;
    @Mock TerminationEvidenceRepository evidence;
    @Mock ContractAgreementRepository agreements;
    @Mock SessionSettlementRepository settlements;
    @Mock DisputeRepository disputes;
    @Mock NotificationDispatcher notifications;
    @Mock Eip712VerificationService verificationService;
    @Mock TerminationLearningClient learning;
    TerminationService service;
    ContractAgreement a;
    @BeforeEach void setup() {
        service = new TerminationService(cases, items, evidence, agreements, settlements, disputes, new ContractAccessControl(), new ObjectMapper(), notifications, verificationService, learning);
        a = ContractAgreement.builder().id(UUID.randomUUID()).classroomId(1L).studentId(2L).studentEmail("s@test.vn")
                .studentWallet("0x1111111111111111111111111111111111111111")
                .tutorId(3L).tutorEmail("t@test.vn").tutorWallet("0x2222222222222222222222222222222222222222")
                .classroomReviewerEmail("staff@test.vn")
                .status(ContractAgreementStatus.ACTIVE).tokenDecimals((short)6).build();
        lenient().when(agreements.findById(a.getId())).thenReturn(Optional.of(a));
        lenient().when(agreements.lockById(a.getId())).thenReturn(Optional.of(a));
        lenient().when(agreements.findByClassroomIdOrderByCreatedAtAsc(1L)).thenReturn(List.of(a));
        lenient().when(verificationService.verifyTerminationSignature(any(), any(), any(), any(), anyBoolean(), anyLong(), anyLong(), any()))
                .thenReturn(true);
        lenient().when(learning.send(anyLong(), anyLong(), any(), anyBoolean(), eq("HOLD")))
                .thenReturn(new TerminationLearningClient.Snapshot(1, List.of(1L)));
    }
    ContractUserPrincipal user(long id, String email, String role) {
        return new ContractUserPrincipal(id, email, role, List.of(role));
    }
    TerminationCase request(String status, boolean wholeClass) {
        var c = new TerminationCase(); c.setId(UUID.randomUUID()); c.setClassroomId(1L); c.setAnchorAgreementId(a.getId());
        c.setStatus(status); c.setWholeClass(wholeClass); c.setAuditJson("[]");
        lenient().when(cases.lockById(c.getId())).thenReturn(Optional.of(c));
        return c;
    }
    @Test void studentCannotTerminateWholeClass() {
        assertThatThrownBy(() -> service.request(a.getId(), true, "Accident", "0xsig", "0x1111111111111111111111111111111111111111", now(), user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("403");
        verify(cases, never()).saveAndFlush(any());
    }
    @Test void tutorCannotTerminateOneStudentAgreement() {
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xsig", "0x2222222222222222222222222222222222222222", now(), user(3, "t@test.vn", "TUTOR")))
                .hasMessageContaining("403");
    }
    @Test void otherStudentCannotRequestThisAgreement() {
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xsig", "0x1111111111111111111111111111111111111111", now(), user(8, "other@test.vn", "STUDENT")))
                .hasMessageContaining("403");
    }
    @Test void studentRequestRejectsMismatchedWallet() {
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xsig", "0x9999999999999999999999999999999999999999", now(), user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("không khớp với ví đã ký hợp đồng");
    }
    @Test void studentRequestRejectsInvalidSignature() {
        when(verificationService.verifyTerminationSignature(any(), any(), any(), any(), anyBoolean(), anyLong(), anyLong(), any()))
                .thenReturn(false);
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xinvalid", "0x1111111111111111111111111111111111111111", now(), user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("Chữ ký số xác nhận từ ví MetaMask không hợp lệ");
    }
    @Test void studentRequestRejectsExpiredSignature() {
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xold",
                "0x1111111111111111111111111111111111111111", now() - 301,
                user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("400");
        verifyNoInteractions(verificationService);
    }
    @Test void studentRequestRejectsReplayedSignature() {
        when(cases.existsBySignature("0xused")).thenReturn(true);
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xused",
                "0x1111111111111111111111111111111111111111", now(),
                user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("409");
        verifyNoInteractions(verificationService);
    }
    @Test void managersCannotSubmitUnsignedPartyRequests() {
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident",
                user(1, "admin@test.vn", "ADMIN")))
                .hasMessageContaining("403");
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident",
                user(4, "staff@test.vn", "STAFF")))
                .hasMessageContaining("403");
    }
    @Test void requestCreatesOperationalHoldWithoutCreatingFinancialItems() {
        var view = service.request(a.getId(), false, "Accident", "0xsig", "0x1111111111111111111111111111111111111111", now(), user(2, "s@test.vn", "STUDENT"));
        assertThat(view.request().getStatus()).isEqualTo("REQUESTED");
        assertThat(view.request().getSignerWallet()).isEqualTo("0x1111111111111111111111111111111111111111");
        assertThat(view.request().getSignature()).isEqualTo("0xsig");
        assertThat(a.getTerminationCutoffSession()).isEqualTo(1);
        verify(learning).send(1L, 2L, a.getId(), false, "HOLD");
        verify(items, never()).save(any());
    }
    @Test void duplicateReportDoesNotBecomeAnotherCase() {
        var existing = new TerminationCase(); existing.setStatus("REQUESTED"); existing.setAnchorAgreementId(a.getId());
        when(cases.findByClassroomIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(existing));
        assertThatThrownBy(() -> service.request(a.getId(), false, "Again", "0xsig", "0x1111111111111111111111111111111111111111", now(), user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("409");
        verify(cases, never()).saveAndFlush(any());
    }
    @Test void assignedStaffCannotApproveFinancialTermination() {
        var c = request("RECOMMENDED", false);
        assertThatThrownBy(() -> service.act(c.getId(), "APPROVE", "Verified", user(4, "staff@test.vn", "STAFF")))
                .hasMessageContaining("403");
        verify(items, never()).save(any());
    }
    @Test void unassignedStaffCannotReview() {
        var c = request("REQUESTED", false);
        assertThatThrownBy(() -> service.act(c.getId(), "RECOMMEND", "Verified", user(4, "other@test.vn", "STAFF")))
                .hasMessageContaining("404");
    }
    @Test void adminApprovalCreatesOnlySelectedAgreementItem() {
        var c = request("RECOMMENDED", false);
        a.setTerminationCutoffSession(1);
        service.act(c.getId(), "APPROVE", "Verified", user(1, "admin@test.vn", "ADMIN"));
        assertThat(a.getTerminationCutoffSession()).isEqualTo(1);
        assertThat(c.getStatus()).isEqualTo("APPROVED");
        var captor = ArgumentCaptor.forClass(TerminationItem.class);
        verify(items).save(captor.capture());
        assertThat(captor.getValue().getAgreementId()).isEqualTo(a.getId());
        assertThat(captor.getValue().getStatus()).isEqualTo("LEARNING_PENDING");
    }
    @Test void adminCanApproveDirectlyFromRequested() {
        var c = request("REQUESTED", false);
        a.setTerminationCutoffSession(1);
        service.act(c.getId(), "APPROVE", "Verified directly by Admin", user(1, "admin@test.vn", "ADMIN"));
        assertThat(c.getStatus()).isEqualTo("APPROVED");
        verify(items).save(any(TerminationItem.class));
    }
    @Test void adminCannotApproveWhileAffectedSessionDisputeIsPending() {
        var c = request("REQUESTED", false);
        a.setTerminationCutoffSession(1);
        when(disputes.existsBySettlement_Agreement_IdAndStatusIn(eq(a.getId()), anyList())).thenReturn(true);

        assertThatThrownBy(() -> service.act(c.getId(), "APPROVE", "Verified", user(1, "admin@test.vn", "ADMIN")))
                .hasMessageContaining("409")
                .hasMessageContaining("khiếu nại");
        assertThat(c.getStatus()).isEqualTo("REQUESTED");
        verify(items, never()).save(any());
    }
    @Test void resolvedDisputeDoesNotBlockApproval() {
        var c = request("REQUESTED", false);
        a.setTerminationCutoffSession(1);
        service.act(c.getId(), "APPROVE", "Dispute resolved", user(1, "admin@test.vn", "ADMIN"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<DisputeStatus>> statuses = ArgumentCaptor.forClass(List.class);
        verify(disputes).existsBySettlement_Agreement_IdAndStatusIn(eq(a.getId()), statuses.capture());
        assertThat(statuses.getValue()).doesNotContain(DisputeStatus.APPROVED, DisputeStatus.REJECTED);
        assertThat(c.getStatus()).isEqualTo("APPROVED");
        verify(items).save(any(TerminationItem.class));
    }
    @Test void studentSeesOnlyOwnFinancialItemFromTutorWholeClassCancellation() {
        var other = agreement(4L, "other@test.vn", ContractAgreementStatus.CANCELLED);
        var c = request("COMPLETED", true);
        c.setCreatedAt(OffsetDateTime.now());
        c.setAnchorAgreementId(other.getId());
        c.setReason("Private tutor medical details");
        c.setAuditJson("private audit");
        c.setSignerWallet("private signer");
        var ownItem = new TerminationItem();
        ownItem.setAgreementId(a.getId()); ownItem.setCaseId(c.getId()); ownItem.setStatus("COMPLETED");
        ownItem.setRefundedUnits(new BigInteger("4200000"));
        var otherItem = new TerminationItem();
        otherItem.setAgreementId(other.getId()); otherItem.setCaseId(c.getId()); otherItem.setStatus("COMPLETED");
        when(cases.findAll()).thenReturn(List.of(c));
        when(items.findByCaseIdOrderByAgreementId(c.getId())).thenReturn(List.of(ownItem, otherItem));
        when(agreements.findById(other.getId())).thenReturn(Optional.of(other));
        a.setTotalAmountUsdcUnits(new BigInteger("7200000"));

        var student = user(2L, "s@test.vn", "STUDENT");
        assertThat(service.list(student)).isEmpty();
        var result = service.listRefunds(student);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).items()).extracting(TerminationService.ItemView::agreementId)
                .containsExactly(a.getId());
        assertThat(result.get(0).items().get(0).refundedUnits()).isEqualTo("4200000");
        assertThat(result.get(0).request().getAnchorAgreementId()).isEqualTo(a.getId());
        assertThat(result.get(0).request().getReason()).doesNotContain("medical");
        assertThat(result.get(0).request().getAuditJson()).isEqualTo("[]");
        assertThat(result.get(0).request().getSignerWallet()).isNull();
        assertThat(result.get(0).evidence()).isEmpty();
    }
    @Test void refundViewSeparatesConfirmedSessionMoneyAndUnusedDeposit() {
        var c = request("COMPLETED", false);
        c.setCreatedAt(OffsetDateTime.now());
        var item = new TerminationItem();
        item.setAgreementId(a.getId()); item.setCaseId(c.getId()); item.setStatus("COMPLETED");
        item.setRefundedUnits(new BigInteger("4200000"));
        a.setStatus(ContractAgreementStatus.CANCELLED);
        a.setTotalAmountUsdcUnits(new BigInteger("7200000"));
        var settled = mock(SessionSettlement.class);
        when(settled.getStatus()).thenReturn(SettlementStatus.SETTLED);
        when(settled.getTutorAmount()).thenReturn(new BigInteger("1530000"));
        when(settled.getPlatformAmount()).thenReturn(new BigInteger("270000"));
        when(settled.getStudentRefundAmount()).thenReturn(new BigInteger("1200000"));
        when(cases.findAll()).thenReturn(List.of(c));
        when(items.findByCaseIdOrderByAgreementId(c.getId())).thenReturn(List.of(item));
        when(settlements.findByAgreementId(a.getId())).thenReturn(List.of(settled));

        var result = service.listRefunds(user(2L, "s@test.vn", "STUDENT")).get(0).items().get(0);
        assertThat(result.depositedUnits()).isEqualTo("7200000");
        assertThat(result.tutorPaidUnits()).isEqualTo("1530000");
        assertThat(result.platformFeeUnits()).isEqualTo("270000");
        assertThat(result.sessionRefundedUnits()).isEqualTo("1200000");
        assertThat(result.refundedUnits()).isEqualTo("4200000");
        assertThat(result.remainingUnits()).isEqualTo("0");
    }
    @Test void adminCannotUseStaffRecommendationAction() {
        var c = request("REQUESTED", false);
        assertThatThrownBy(() -> service.act(c.getId(), "RECOMMEND", "Review complete", user(1, "admin@test.vn", "ADMIN")))
                .hasMessageContaining("Only assigned Staff can recommend termination");
        verify(items, never()).save(any());
    }
    @Test void managerRejectionReleasesOperationalHold() {
        var c = request("REQUESTED", false);
        a.setTerminationCutoffSession(1);
        service.act(c.getId(), "REJECT", "Evidence is insufficient", user(1, "admin@test.vn", "ADMIN"));
        assertThat(c.getStatus()).isEqualTo("REJECTED");
        assertThat(a.getTerminationCutoffSession()).isNull();
        verify(learning).send(1L, 2L, a.getId(), false, "RELEASE");
    }
    @Test void wholeClassHoldNotifiesOnlyStudentsWithActiveAgreements() {
        var active = agreement(4L, "active@test.vn", ContractAgreementStatus.ACTIVE);
        var cancelled = agreement(5L, "cancelled@test.vn", ContractAgreementStatus.CANCELLED);
        when(agreements.findByClassroomIdOrderByCreatedAtAsc(1L)).thenReturn(List.of(a, active, cancelled));

        service.request(a.getId(), true, "Tutor cannot continue", "0xsig",
                "0x2222222222222222222222222222222222222222", now(), user(3, "t@test.vn", "TUTOR"));

        assertThat(active.getTerminationCutoffSession()).isEqualTo(1);
        assertThat(cancelled.getTerminationCutoffSession()).isNull();
        verify(notifications).sendAsync(eq("active@test.vn"), eq(4L), eq("Lop hoc tam dung cho xu ly"),
                anyString(), eq("TERMINATION_UPDATED"), eq("AGREEMENT"), eq(active.getId().toString()));
        verify(notifications, never()).sendAsync(eq("cancelled@test.vn"), anyLong(), anyString(),
                anyString(), anyString(), anyString(), anyString());
    }
    @Test void wholeClassRejectionNotifiesActiveStudentsAndIgnoresPreviousCancellations() {
        var active = agreement(4L, "active@test.vn", ContractAgreementStatus.ACTIVE);
        var cancelled = agreement(5L, "cancelled@test.vn", ContractAgreementStatus.CANCELLED);
        a.setTerminationCutoffSession(1);
        active.setTerminationCutoffSession(1);
        when(agreements.findByClassroomIdOrderByCreatedAtAsc(1L)).thenReturn(List.of(a, active, cancelled));
        var c = request("REQUESTED", true);

        service.act(c.getId(), "REJECT", "Class can continue", user(1, "admin@test.vn", "ADMIN"));

        assertThat(c.getStatus()).isEqualTo("REJECTED");
        assertThat(a.getTerminationCutoffSession()).isNull();
        assertThat(active.getTerminationCutoffSession()).isNull();
        verify(notifications).sendAsync(eq("active@test.vn"), eq(4L), eq("Lop hoc tiep tuc"),
                anyString(), eq("TERMINATION_UPDATED"), eq("AGREEMENT"), eq(active.getId().toString()));
        verify(notifications, never()).sendAsync(eq("cancelled@test.vn"), anyLong(), anyString(),
                anyString(), anyString(), anyString(), anyString());
    }
    @Test void studentCanAddEvidenceToPendingRequest() {
        var c = request("REQUESTED", false);
        when(cases.findById(c.getId())).thenReturn(Optional.of(c));
        when(evidence.countByTerminationCaseIdAndSubmittedByUserId(c.getId(), 2L)).thenReturn(0L);
        var stored = new DisputeEvidenceStorageService.StoredEvidence(
                "terminations/" + c.getId() + "/student/uuid-doc.pdf",
                "doc.pdf", "application/pdf", 1024L, "0xhash");
        var view = service.addEvidence(c.getId(), user(2, "s@test.vn", "STUDENT"), stored);
        verify(evidence).save(any(TerminationEvidence.class));
    }
    @Test void partyCannotAddMoreThanFiveEvidenceFiles() {
        var c = request("REQUESTED", false);
        when(cases.findById(c.getId())).thenReturn(Optional.of(c));
        when(evidence.countByTerminationCaseIdAndSubmittedByUserId(c.getId(), 2L)).thenReturn(5L);
        var stored = new DisputeEvidenceStorageService.StoredEvidence(
                "terminations/" + c.getId() + "/student/uuid-doc.pdf",
                "doc.pdf", "application/pdf", 1024L, "0xhash");
        assertThatThrownBy(() -> service.addEvidence(c.getId(), user(2, "s@test.vn", "STUDENT"), stored))
                .hasMessageContaining("409")
                .hasMessageContaining("tối đa 5 file minh chứng");
        verify(evidence, never()).save(any());
    }
    @Test void cannotAddEvidenceToCompletedCase() {
        var c = request("COMPLETED", false);
        when(cases.findById(c.getId())).thenReturn(Optional.of(c));
        var stored = new DisputeEvidenceStorageService.StoredEvidence(
                "terminations/" + c.getId() + "/student/uuid-doc.pdf",
                "doc.pdf", "application/pdf", 1024L, "0xhash");
        assertThatThrownBy(() -> service.addEvidence(c.getId(), user(2, "s@test.vn", "STUDENT"), stored))
                .hasMessageContaining("409");
        verify(evidence, never()).save(any());
    }
    private ContractAgreement agreement(long studentId, String studentEmail, ContractAgreementStatus status) {
        return ContractAgreement.builder()
                .id(UUID.randomUUID()).classroomId(1L).studentId(studentId).studentEmail(studentEmail)
                .studentWallet("0x1111111111111111111111111111111111111111")
                .tutorId(3L).tutorEmail("t@test.vn").tutorWallet("0x2222222222222222222222222222222222222222")
                .classroomReviewerEmail("staff@test.vn").status(status).tokenDecimals((short) 6).build();
    }
    private long now() { return System.currentTimeMillis() / 1000L; }
}
