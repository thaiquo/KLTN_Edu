package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SessionFinalizationSchedulerTest {

    @Test
    void startupScanQueuesEveryConfirmedProposalWhoseDisputeWindowExpired() {
        SessionSettlementRepository repository = mock(SessionSettlementRepository.class);
        SessionSettlementWorkflowService workflow = mock(SessionSettlementWorkflowService.class);
        SessionSettlement first = mock(SessionSettlement.class);
        SessionSettlement second = mock(SessionSettlement.class);
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        when(first.getId()).thenReturn(firstId);
        when(second.getId()).thenReturn(secondId);
        when(repository.findTop50ByStatusAndDisputeDeadlineBeforeOrderByDisputeDeadlineAsc(
                eq(SettlementStatus.PROPOSED), any(OffsetDateTime.class)))
                .thenReturn(List.of(first, second));

        new SessionFinalizationScheduler(repository, workflow).finalizeEligibleSessions();

        verify(workflow).initiateSessionFinalization(firstId);
        verify(workflow).initiateSessionFinalization(secondId);
    }
}
