package iuh.fit.contract_service.service;

import iuh.fit.contract_service.repository.TerminationCaseRepository;
import iuh.fit.contract_service.repository.TerminationItemRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TerminationSchedulerTest {

    @Mock TerminationCaseRepository cases;
    @Mock TerminationItemRepository items;
    @Mock TerminationProcessor processor;
    @Mock TerminationSignals signals;
    @Mock TerminationService service;

    @InjectMocks
    TerminationScheduler scheduler;

    @Test
    @DisplayName("tick triggers signal detection, sync, expiry candidates, and approved item processing")
    void tickExecutesExpiryAndProcessing() {
        UUID expiredTutorCaseId = UUID.randomUUID();
        UUID expiredAdminCaseId = UUID.randomUUID();
        UUID expiredReleaseCaseId = UUID.randomUUID();
        UUID expiredHoldSyncCaseId = UUID.randomUUID();

        when(cases.findTop50ByStatusOrderByUpdatedAtAsc("HOLD_PENDING")).thenReturn(Collections.emptyList());
        when(cases.findTop50ByStatusOrderByUpdatedAtAsc("RELEASE_PENDING")).thenReturn(Collections.emptyList());
        when(cases.findTop50ByStatusOrderByUpdatedAtAsc("APPROVED")).thenReturn(Collections.emptyList());

        when(cases.findExpiredResponseCandidateIds(any(OffsetDateTime.class))).thenReturn(List.of(expiredTutorCaseId));
        when(cases.findExpiredDecisionCandidateIds(any(OffsetDateTime.class))).thenReturn(List.of(expiredAdminCaseId));
        when(cases.findExpiredReleaseCandidateIds(any(OffsetDateTime.class))).thenReturn(List.of(expiredReleaseCaseId));
        when(cases.findExpiredHoldSyncCandidateIds(any(OffsetDateTime.class))).thenReturn(List.of(expiredHoldSyncCaseId));

        scheduler.tick();

        verify(signals).detect();
        verify(service).processAbsenceExpiry(expiredTutorCaseId, "NO_TUTOR_RESPONSE");
        verify(service).processAbsenceExpiry(expiredAdminCaseId, "NO_ADMIN_DECISION");
        verify(service).processAbsenceExpiry(expiredReleaseCaseId, "RELEASE_TIMEOUT");
        verify(service).processAbsenceExpiry(expiredHoldSyncCaseId, "HOLD_SYNC_TIMEOUT");
    }
}
