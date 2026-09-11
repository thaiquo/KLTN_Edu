package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.*;
import iuh.fit.learning_service.repository.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SessionSettlementDeliveryServiceTest {
    @Test
    void emptyAttendanceLedgerIsAcknowledgedOnlyWhenContractServiceAcceptsIt() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = new SessionSettlementDeliveryService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L);
        var session = new ClassSession(); session.setId(999L); session.setSequenceNumber(2); session.setClassRoom(room);
        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED))
                .thenReturn(List.of(session));
        when(attendances.findBySessionId(999L)).thenReturn(List.of());
        when(dispatcher.dispatchAutoPropose(8L, 2L, List.of())).thenReturn(false, true);

        service.deliverPending();
        assertThat(session.isSettlementDispatched()).isFalse();
        verify(sessions, never()).save(session);

        service.deliverPending();
        assertThat(session.isSettlementDispatched()).isTrue();
        verify(sessions).save(session);
        verify(dispatcher, times(2)).dispatchAutoPropose(8L, 2L, List.of());
    }

    @Test
    void retriesFailedDeliveryAndUsesClassSequenceInsteadOfDatabaseId() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = new SessionSettlementDeliveryService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L);
        var session = new ClassSession(); session.setId(999L); session.setSequenceNumber(2); session.setClassRoom(room);
        var attendance = new SessionAttendance(); attendance.setStudentId(17L); attendance.setFinalOutcome(AttendanceOutcome.TUTOR_ABSENT);
        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(session));
        when(attendances.findBySessionId(999L)).thenReturn(List.of(attendance));
        var payload = List.of(new ContractServiceDispatcher.StudentAttendanceOutcomeItem(17L, "TUTOR_ABSENT"));
        when(dispatcher.dispatchAutoPropose(8L, 2L, payload)).thenReturn(false, true);
        service.deliverPending();
        assertThat(session.isSettlementDispatched()).isFalse();
        verify(sessions, never()).save(session);
        service.deliverPending();
        assertThat(session.isSettlementDispatched()).isTrue();
        verify(sessions).save(session);
        verify(dispatcher, times(2)).dispatchAutoPropose(8L, 2L, payload);
    }
}
