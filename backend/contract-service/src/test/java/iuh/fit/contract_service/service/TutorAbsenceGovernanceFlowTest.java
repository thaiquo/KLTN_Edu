package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.security.ContractAccessControl;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.TerminationCase;
import iuh.fit.contract_service.entity.TutorAbsenceProbation;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TutorAbsenceGovernanceFlowTest {

    @Mock TerminationCaseRepository cases;
    @Mock TerminationItemRepository items;
    @Mock TerminationEvidenceRepository evidence;
    @Mock ContractAgreementRepository agreements;
    @Mock SessionSettlementRepository settlements;
    @Mock DisputeRepository disputes;
    @Mock NotificationDispatcher notifications;
    @Mock Eip712VerificationService verificationService;
    @Mock TerminationLearningClient learning;
    @Mock AgreementTrialRepository trialRepository;
    @Mock TutorAbsenceProbationRepository probationRepository;

    TutorAbsenceDeadlinePolicy deadlinePolicy;
    TerminationService service;
    ContractAgreement agreement;

    @BeforeEach
    void setUp() {
        deadlinePolicy = new TutorAbsenceDeadlinePolicy();
        service = new TerminationService(
                cases, items, evidence, agreements, settlements, disputes,
                new ContractAccessControl(), new ObjectMapper(), notifications,
                verificationService, learning, trialRepository, probationRepository,
                deadlinePolicy
        );

        agreement = ContractAgreement.builder()
                .id(UUID.randomUUID())
                .classroomId(100L)
                .studentId(10L)
                .studentEmail("student@test.vn")
                .tutorId(20L)
                .tutorEmail("tutor@test.vn")
                .status(ContractAgreementStatus.ACTIVE)
                .tokenDecimals((short) 6)
                .build();

        lenient().when(agreements.findById(agreement.getId())).thenReturn(Optional.of(agreement));
        lenient().when(agreements.lockById(agreement.getId())).thenReturn(Optional.of(agreement));
        lenient().when(agreements.findByClassroomIdOrderByCreatedAtAsc(100L)).thenReturn(List.of(agreement));
    }

    private ContractUserPrincipal user(long id, String email, String role) {
        return new ContractUserPrincipal(id, email, role, List.of(role));
    }

    private TerminationCase createAbsenceCase(String status, OffsetDateTime responseDeadline, OffsetDateTime decisionDeadline) {
        TerminationCase c = new TerminationCase();
        c.setId(UUID.randomUUID());
        c.setClassroomId(100L);
        c.setAnchorAgreementId(agreement.getId());
        c.setOrigin("AUTO_TUTOR_ABSENCE");
        c.setAbsenceGovernanceVersion((short) 1);
        c.setStatus(status);
        c.setWholeClass(true);
        c.setAuditJson("[]");
        c.setTriggerSessionSequence(3);
        c.setNextSessionSequence(4);
        c.setResponseDeadline(responseDeadline);
        c.setDecisionDeadline(decisionDeadline);

        lenient().when(cases.findById(c.getId())).thenReturn(Optional.of(c));
        lenient().when(cases.lockById(c.getId())).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    @DisplayName("Tutor can RESPOND before responseDeadline")
    void tutorCanRespondBeforeDeadline() {
        OffsetDateTime now = OffsetDateTime.now();
        var c = createAbsenceCase("REQUESTED", now.plusHours(12), now.plusHours(36));

        service.act(c.getId(), "RESPOND", "Gia sư bị tai nạn bất khả kháng có bệnh án xác nhận.", user(20L, "tutor@test.vn", "TUTOR"));

        assertThat(c.getTutorRespondedAt()).isNotNull();
    }

    @Test
    @DisplayName("Tutor cannot RESPOND after responseDeadline expires (throws 409 CONFLICT)")
    void tutorCannotRespondAfterDeadline() {
        OffsetDateTime now = OffsetDateTime.now();
        // Expired 1 hour ago
        var c = createAbsenceCase("REQUESTED", now.minusHours(1), now.plusHours(20));

        assertThatThrownBy(() -> service.act(c.getId(), "RESPOND", "Giải trình trễ hạn", user(20L, "tutor@test.vn", "TUTOR")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT")
                .hasMessageContaining("Thời hạn gửi giải trình đã kết thúc");
    }

    @Test
    @DisplayName("Tutor cannot upload evidence after responseDeadline expires")
    void tutorCannotAddEvidenceAfterDeadline() {
        OffsetDateTime now = OffsetDateTime.now();
        var c = createAbsenceCase("REQUESTED", now.minusMinutes(10), now.plusHours(20));

        assertThatThrownBy(() -> service.requireCanAddEvidence(c.getId(), user(20L, "tutor@test.vn", "TUTOR")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT")
                .hasMessageContaining("Thời hạn tải minh chứng cho cảnh cáo vắng học đã kết thúc");
    }

    @Test
    @DisplayName("Admin cannot REJECT after decisionDeadline expires (throws 409 CONFLICT)")
    void adminCannotRejectAfterDecisionDeadline() {
        OffsetDateTime now = OffsetDateTime.now();
        // Decision deadline expired 5 minutes ago
        var c = createAbsenceCase("REQUESTED", now.minusHours(15), now.minusMinutes(5));
        c.setTutorRespondedAt(now.minusHours(16));

        assertThatThrownBy(() -> service.act(c.getId(), "REJECT", "Cho phep day tiep", user(1L, "admin@test.vn", "ADMIN")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT")
                .hasMessageContaining("Thời hạn ra quyết định cho lớp tiếp tục đã hết");
    }

    @Test
    @DisplayName("Admin REJECT before decisionDeadline creates active probation for session N+1")
    void adminRejectCreatesActiveProbation() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime s = now.plusHours(18);
        var c = createAbsenceCase("REQUESTED", now.plusHours(6), s);
        c.setHoldCommandId(UUID.randomUUID());
        c.setTutorRespondedAt(now);

        service.act(c.getId(), "REJECT", "Admin đồng ý cho gia sư dạy tiếp có điều kiện", user(1L, "admin@test.vn", "ADMIN"));

        assertThat(c.getReleaseCommandId()).isNotNull();

        ArgumentCaptor<TutorAbsenceProbation> captor = ArgumentCaptor.forClass(TutorAbsenceProbation.class);
        verify(probationRepository).saveAndFlush(captor.capture());
        TutorAbsenceProbation p = captor.getValue();
        assertThat(p.getClassroomId()).isEqualTo(100L);
        assertThat(p.getSessionSequence()).isEqualTo(4);
        assertThat(p.getStatus()).isEqualTo("ACTIVE");
        assertThat(p.getActiveClassroomGuard()).isEqualTo(100L);
        assertThat(p.getSourceCaseId()).isEqualTo(c.getId());
    }

    @Test
    @DisplayName("Admin cannot continue the class before Tutor submits an explanation")
    void adminCannotRejectWithoutTutorResponse() {
        OffsetDateTime now = OffsetDateTime.now();
        var c = createAbsenceCase("REQUESTED", now.plusHours(6), now.plusHours(18));

        assertThatThrownBy(() -> service.act(c.getId(), "REJECT", "Cho phep day tiep", user(1L, "admin@test.vn", "ADMIN")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT")
                .hasMessageContaining("Tutor must submit an explanation");

        verify(probationRepository, never()).saveAndFlush(any());
        verifyNoInteractions(learning);
    }

    @Test
    @DisplayName("processAbsenceExpiry executes NO_TUTOR_RESPONSE auto-decision under lock")
    void processAbsenceExpiryNoTutorResponse() {
        OffsetDateTime now = OffsetDateTime.now();
        var c = createAbsenceCase("REQUESTED", now.minusHours(1), now.plusHours(15));
        c.setTutorRespondedAt(null);

        service.processAbsenceExpiry(c.getId(), "NO_TUTOR_RESPONSE");

        assertThat(c.getStatus()).isEqualTo("APPROVED");
        assertThat(c.getAutoDecisionReason()).isEqualTo("NO_TUTOR_RESPONSE");
        assertThat(c.getAutoDecisionAt()).isNotNull();
        verify(cases).saveAndFlush(c);
        verify(items).save(any());
    }

    @Test
    @DisplayName("processAbsenceExpiry executes NO_ADMIN_DECISION auto-decision under lock")
    void processAbsenceExpiryNoAdminDecision() {
        OffsetDateTime now = OffsetDateTime.now();
        var c = createAbsenceCase("REQUESTED", now.minusHours(24), now.minusMinutes(1));
        c.setTutorRespondedAt(now.minusHours(20)); // Tutor did respond, but Admin did not decide

        service.processAbsenceExpiry(c.getId(), "NO_ADMIN_DECISION");

        assertThat(c.getStatus()).isEqualTo("APPROVED");
        assertThat(c.getAutoDecisionReason()).isEqualTo("NO_ADMIN_DECISION");
        assertThat(c.getAutoDecisionAt()).isNotNull();
        verify(cases).saveAndFlush(c);
    }

    @Test
    @DisplayName("processAbsenceExpiry does nothing if preconditions not met (e.g. deadline not reached)")
    void processAbsenceExpiryNoOpWhenNotExpired() {
        OffsetDateTime now = OffsetDateTime.now();
        var c = createAbsenceCase("REQUESTED", now.plusHours(5), now.plusHours(20));

        service.processAbsenceExpiry(c.getId(), "NO_TUTOR_RESPONSE");

        assertThat(c.getStatus()).isEqualTo("REQUESTED");
        assertThat(c.getAutoDecisionReason()).isNull();
        verify(cases, never()).saveAndFlush(c);
    }
}
