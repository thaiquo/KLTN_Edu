package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.mockito.Mockito.*;

class TerminationSignalsTest {
    final ContractAgreementRepository agreements = mock(ContractAgreementRepository.class);
    final SessionSettlementRepository settlements = mock(SessionSettlementRepository.class);
    final DisputeRepository disputes = mock(DisputeRepository.class);
    final TerminationService service = mock(TerminationService.class);
    final TerminationSignals signals = new TerminationSignals(agreements, settlements, disputes, service);
    SessionSettlement absent(long sequence) {
        var s = mock(SessionSettlement.class);
        when(s.getSessionId()).thenReturn(sequence); when(s.getStatus()).thenReturn(SettlementStatus.REFUNDED);
        lenient().when(s.getOutcome()).thenReturn(SettlementOutcome.TUTOR_ABSENT);
        return s;
    }
    @Test void threeDistinctConsecutiveAbsencesCreateReviewOnly() {
        var a = ContractAgreement.builder().id(UUID.randomUUID()).classroomId(1L).build();
        when(agreements.findByStatus(ContractAgreementStatus.ACTIVE)).thenReturn(List.of(a));
        var rows = List.of(absent(1), absent(2), absent(3));
        when(settlements.findByAgreementId(a.getId())).thenReturn(rows);
        signals.detect();
        verify(service).requestSystemReview(eq(a.getId()), eq("TUTOR_ABSENT:1:3"), anyString());
        verifyNoMoreInteractions(service);
    }
    @Test void nonconsecutiveAbsencesDoNotTrigger() {
        var a = ContractAgreement.builder().id(UUID.randomUUID()).classroomId(1L).build();
        when(agreements.findByStatus(ContractAgreementStatus.ACTIVE)).thenReturn(List.of(a));
        var rows = List.of(absent(1), absent(3), absent(5));
        when(settlements.findByAgreementId(a.getId())).thenReturn(rows);
        signals.detect();
        verifyNoInteractions(service);
    }
}
