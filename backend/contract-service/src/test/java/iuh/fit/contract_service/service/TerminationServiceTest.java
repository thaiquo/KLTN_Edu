package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.security.*;
import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TerminationServiceTest {
    @Mock TerminationCaseRepository cases;
    @Mock TerminationItemRepository items;
    @Mock ContractAgreementRepository agreements;
    @Mock NotificationDispatcher notifications;
    @Mock Eip712VerificationService verificationService;
    TerminationService service;
    ContractAgreement a;
    @BeforeEach void setup() {
        service = new TerminationService(cases, items, agreements, new ContractAccessControl(), new ObjectMapper(), notifications, verificationService);
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
    }
    ContractUserPrincipal user(long id, String email, String role) {
        return new ContractUserPrincipal(id, email, role, List.of(role));
    }
    TerminationCase request(String status, boolean wholeClass) {
        var c = new TerminationCase(); c.setId(UUID.randomUUID()); c.setClassroomId(1L); c.setAnchorAgreementId(a.getId());
        c.setStatus(status); c.setWholeClass(wholeClass); c.setAuditJson("[]");
        when(cases.lockById(c.getId())).thenReturn(Optional.of(c));
        return c;
    }
    @Test void studentCannotTerminateWholeClass() {
        assertThatThrownBy(() -> service.request(a.getId(), true, "Accident", "0xsig", "0x1111111111111111111111111111111111111111", 1000L, user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("403");
        verify(cases, never()).saveAndFlush(any());
    }
    @Test void otherStudentCannotRequestThisAgreement() {
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xsig", "0x1111111111111111111111111111111111111111", 1000L, user(8, "other@test.vn", "STUDENT")))
                .hasMessageContaining("403");
    }
    @Test void studentRequestRejectsMismatchedWallet() {
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xsig", "0x9999999999999999999999999999999999999999", 1000L, user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("không khớp với ví đã ký hợp đồng");
    }
    @Test void studentRequestRejectsInvalidSignature() {
        when(verificationService.verifyTerminationSignature(any(), any(), any(), any(), anyBoolean(), anyLong(), anyLong(), any()))
                .thenReturn(false);
        assertThatThrownBy(() -> service.request(a.getId(), false, "Accident", "0xinvalid", "0x1111111111111111111111111111111111111111", 1000L, user(2, "s@test.vn", "STUDENT")))
                .hasMessageContaining("Chữ ký số xác nhận từ ví MetaMask không hợp lệ");
    }
    @Test void requestDoesNotFreezeLearningOrChangeAgreement() {
        var view = service.request(a.getId(), false, "Accident", "0xsig", "0x1111111111111111111111111111111111111111", 1000L, user(2, "s@test.vn", "STUDENT"));
        assertThat(view.request().getStatus()).isEqualTo("REQUESTED");
        assertThat(view.request().getSignerWallet()).isEqualTo("0x1111111111111111111111111111111111111111");
        assertThat(view.request().getSignature()).isEqualTo("0xsig");
        assertThat(a.getTerminationCutoffSession()).isNull();
        verifyNoInteractions(items);
    }
    @Test void duplicateReportDoesNotBecomeAnotherCase() {
        var existing = new TerminationCase(); existing.setStatus("REQUESTED"); existing.setAnchorAgreementId(a.getId());
        when(cases.findByClassroomIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(existing));
        assertThatThrownBy(() -> service.request(a.getId(), false, "Again", "0xsig", "0x1111111111111111111111111111111111111111", 1000L, user(2, "s@test.vn", "STUDENT")))
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
        service.act(c.getId(), "APPROVE", "Verified", user(1, "admin@test.vn", "ADMIN"));
        assertThat(a.getTerminationCutoffSession()).isEqualTo(-1);
        assertThat(c.getStatus()).isEqualTo("APPROVED");
        var captor = ArgumentCaptor.forClass(TerminationItem.class);
        verify(items).save(captor.capture());
        assertThat(captor.getValue().getAgreementId()).isEqualTo(a.getId());
        assertThat(captor.getValue().getStatus()).isEqualTo("LEARNING_PENDING");
    }
    @Test void studentCannotReadClassFileContainingOtherStudents() {
        var c = new TerminationCase(); c.setWholeClass(true); c.setAnchorAgreementId(a.getId());
        assertThat(service.canView(c, user(2, "s@test.vn", "STUDENT"))).isFalse();
    }
}
