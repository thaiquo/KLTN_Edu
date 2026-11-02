package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.entity.DisputeHistory;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.DisputeEscalationStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.repository.DisputeHistoryRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DisputeEscalationServiceTest {
    @Mock DisputeRepository disputes;
    @Mock DisputeHistoryRepository history;
    @Mock TerminationNotificationOutbox notifications;
    DisputeEscalationService service;
    UUID id;
    Dispute dispute;

    @BeforeEach void setUp() {
        service = new DisputeEscalationService(disputes, history, notifications);
        id = UUID.randomUUID();
        ContractAgreement agreement = mock(ContractAgreement.class);
        lenient().when(agreement.getClassroomReviewerEmail()).thenReturn("staff@test.vn");
        SessionSettlement settlement = mock(SessionSettlement.class);
        lenient().when(settlement.getAgreement()).thenReturn(agreement);
        dispute = Dispute.builder().id(id).settlement(settlement).status(DisputeStatus.OPEN)
                .escalationStatus(DisputeEscalationStatus.NONE).build();
        lenient().when(history.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        lenient().when(disputes.findByIdForUpdate(id)).thenReturn(Optional.of(dispute));
    }

    @Test void assignedStaffEscalatesOnceWithoutChangingDisputeOrSettlementStatus() {
        var actor = new ContractUserPrincipal(10L, "staff@test.vn", "STAFF", List.of("STAFF"));
        service.requestEscalation(id, "Cần Admin quyết định trường hợp ngoại lệ", "request-1", actor);
        assertThat(dispute.getStatus()).isEqualTo(DisputeStatus.OPEN);
        assertThat(dispute.getEscalationStatus()).isEqualTo(DisputeEscalationStatus.PENDING_ADMIN);
        verify(history).save(any(DisputeHistory.class));
        verify(notifications).enqueue(anyString(), any());
    }

    @Test void unassignedStaffCannotEscalate() {
        var actor = new ContractUserPrincipal(11L, "other@test.vn", "STAFF", List.of("STAFF"));
        assertThatThrownBy(() -> service.requestEscalation(id, "reason", "request-2", actor))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value()).isEqualTo(403));
        verify(history, never()).save(any());
    }

    @Test void retryWithSameIdempotencyKeyIsNoop() {
        var actor = new ContractUserPrincipal(10L, "staff@test.vn", "STAFF", List.of("STAFF"));
        when(history.findByIdempotencyKey("ESCALATE:" + id + ":request-3"))
                .thenReturn(Optional.of(mock(DisputeHistory.class)));
        when(disputes.findByIdWithSettlementAndAgreement(id)).thenReturn(Optional.of(dispute));
        assertThat(service.requestEscalation(id, "reason", "request-3", actor)).isSameAs(dispute);
        verify(disputes, never()).save(any());
        verify(notifications, never()).enqueue(anyString(), any());
    }

    @Test void adminAcceptsPendingEscalation() {
        dispute.setEscalationStatus(DisputeEscalationStatus.PENDING_ADMIN);
        var actor = new ContractUserPrincipal(1L, "admin@test.vn", "ADMIN", List.of("ADMIN"));
        service.accept(id, "Tiếp nhận", "accept-1", actor);
        assertThat(dispute.getEscalationStatus()).isEqualTo(DisputeEscalationStatus.ACCEPTED_BY_ADMIN);
        assertThat(dispute.getEscalationHandledByEmail()).isEqualTo("admin@test.vn");
    }
}
