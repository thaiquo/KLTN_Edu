package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.*;
import iuh.fit.learning_service.repository.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SessionSettlementDeliveryServiceTest {

    @Test
    void emptyAttendanceLedgerIsAcknowledgedOnlyWhenContractServiceAcceptsIt() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L);
        var session = new ClassSession(); session.setId(999L); session.setSequenceNumber(2); session.setClassRoom(room);
        session.setAttendanceFinalizedAt(java.time.OffsetDateTime.parse("2026-10-28T00:00:00Z"));

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED))
                .thenReturn(List.of(session));
        when(sessions.findById(999L)).thenReturn(Optional.of(session));
        when(attendances.findBySessionId(999L)).thenReturn(List.of());
        when(dispatcher.dispatchAutoPropose(eq(8L), eq(2L), any(ContractServiceDispatcher.AutoProposePayload.class)))
                .thenReturn(false, true);

        service.deliverPending();
        assertThat(session.isSettlementDispatched()).isFalse();
        verify(sessions, never()).save(session);

        service.deliverPending();
        assertThat(session.isSettlementDispatched()).isTrue();
        verify(sessions, atLeastOnce()).save(session);

        var payloadCaptor = ArgumentCaptor.forClass(ContractServiceDispatcher.AutoProposePayload.class);
        verify(dispatcher, times(2)).dispatchAutoPropose(eq(8L), eq(2L), payloadCaptor.capture());
        var captured = payloadCaptor.getValue();
        assertThat(captured.tutorAttendanceOutcome()).isEqualTo("UNAVAILABLE");
        assertThat(captured.attendances()).isEmpty();
        assertThat(captured.sourceEventId()).isEqualTo("ATTENDANCE:8:2:v1");
    }

    @Test
    void retriesFailedDeliveryAndUsesClassSequenceInsteadOfDatabaseId() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L);
        var session = new ClassSession(); session.setId(999L); session.setSequenceNumber(2); session.setClassRoom(room);
        session.setAttendanceFinalizedAt(java.time.OffsetDateTime.parse("2026-10-28T00:00:00Z"));
        var attendance = new SessionAttendance(); attendance.setStudentId(17L); attendance.setFinalOutcome(AttendanceOutcome.TUTOR_ABSENT);

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(session));
        when(sessions.findById(999L)).thenReturn(Optional.of(session));
        when(attendances.findBySessionId(999L)).thenReturn(List.of(attendance));
        when(dispatcher.dispatchAutoPropose(eq(8L), eq(2L), any(ContractServiceDispatcher.AutoProposePayload.class)))
                .thenReturn(false, true);

        service.deliverPending();
        assertThat(session.isSettlementDispatched()).isFalse();

        service.deliverPending();
        assertThat(session.isSettlementDispatched()).isTrue();

        var payloadCaptor = ArgumentCaptor.forClass(ContractServiceDispatcher.AutoProposePayload.class);
        verify(dispatcher, times(2)).dispatchAutoPropose(eq(8L), eq(2L), payloadCaptor.capture());
        var captured = payloadCaptor.getValue();
        assertThat(captured.tutorAttendanceOutcome()).isEqualTo("TUTOR_ABSENT");
        assertThat(captured.sessionSequence()).isEqualTo(2);
        assertThat(captured.learningSessionId()).isEqualTo(999L);
        assertThat(captured.attendances()).hasSize(1);
        assertThat(captured.attendances().get(0).outcome()).isEqualTo("TUTOR_ABSENT");
    }

    @Test
    void detectsTutorPresentWhenAllAttendancesAreBothPresentOrStudentAbsent() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L);
        var session = new ClassSession(); session.setId(999L); session.setSequenceNumber(2); session.setClassRoom(room);
        session.setAttendanceFinalizedAt(java.time.OffsetDateTime.parse("2026-10-28T00:00:00Z"));

        var a1 = new SessionAttendance(); a1.setStudentId(10L); a1.setFinalOutcome(AttendanceOutcome.BOTH_PRESENT);
        var a2 = new SessionAttendance(); a2.setStudentId(11L); a2.setFinalOutcome(AttendanceOutcome.STUDENT_ABSENT_TUTOR_PRESENT);

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(session));
        when(sessions.findById(999L)).thenReturn(Optional.of(session));
        when(attendances.findBySessionId(999L)).thenReturn(List.of(a1, a2));
        when(dispatcher.dispatchAutoPropose(eq(8L), eq(2L), any(ContractServiceDispatcher.AutoProposePayload.class))).thenReturn(true);

        service.deliverPending();

        var payloadCaptor = ArgumentCaptor.forClass(ContractServiceDispatcher.AutoProposePayload.class);
        verify(dispatcher).dispatchAutoPropose(eq(8L), eq(2L), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().tutorAttendanceOutcome()).isEqualTo("TUTOR_PRESENT");
    }

    @Test
    void detectsInconsistentWhenMixedAttendanceOutcomesExist() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L);
        var session = new ClassSession(); session.setId(999L); session.setSequenceNumber(2); session.setClassRoom(room);
        session.setAttendanceFinalizedAt(java.time.OffsetDateTime.parse("2026-10-28T00:00:00Z"));

        var a1 = new SessionAttendance(); a1.setStudentId(10L); a1.setFinalOutcome(AttendanceOutcome.BOTH_PRESENT);
        var a2 = new SessionAttendance(); a2.setStudentId(11L); a2.setFinalOutcome(AttendanceOutcome.TUTOR_ABSENT);

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(session));
        when(sessions.findById(999L)).thenReturn(Optional.of(session));
        when(attendances.findBySessionId(999L)).thenReturn(List.of(a1, a2));
        when(dispatcher.dispatchAutoPropose(eq(8L), eq(2L), any(ContractServiceDispatcher.AutoProposePayload.class))).thenReturn(true);

        service.deliverPending();

        var payloadCaptor = ArgumentCaptor.forClass(ContractServiceDispatcher.AutoProposePayload.class);
        verify(dispatcher).dispatchAutoPropose(eq(8L), eq(2L), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().tutorAttendanceOutcome()).isEqualTo("INCONSISTENT");
    }

    @Test
    void snapshotsNextSessionSequenceAndStartTime() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L); room.setTotalSessions(5);
        var session2 = new ClassSession(); session2.setId(992L); session2.setSequenceNumber(2); session2.setClassRoom(room);
        session2.setAttendanceFinalizedAt(java.time.OffsetDateTime.parse("2026-10-28T00:00:00Z"));
        var session3 = new ClassSession(); session3.setId(993L); session3.setSequenceNumber(3); session3.setClassRoom(room);
        session3.setSessionDate(LocalDate.of(2026, 11, 1));
        session3.setStartTime("14:00");
        session3.setStatus(ClassSessionStatus.SCHEDULED);

        var a1 = new SessionAttendance(); a1.setStudentId(10L); a1.setFinalOutcome(AttendanceOutcome.TUTOR_ABSENT);

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(session2));
        when(sessions.findById(992L)).thenReturn(Optional.of(session2));
        when(attendances.findBySessionId(992L)).thenReturn(List.of(a1));
        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(8L)).thenReturn(List.of(session2, session3));
        when(dispatcher.dispatchAutoPropose(eq(8L), eq(2L), any(ContractServiceDispatcher.AutoProposePayload.class))).thenReturn(true);

        service.deliverPending();

        var payloadCaptor = ArgumentCaptor.forClass(ContractServiceDispatcher.AutoProposePayload.class);
        verify(dispatcher).dispatchAutoPropose(eq(8L), eq(2L), payloadCaptor.capture());
        var payload = payloadCaptor.getValue();
        assertThat(payload.nextSessionSequence()).isEqualTo(3);
        assertThat(payload.nextSessionStartAt()).isNotNull();
        assertThat(session2.getGovernanceNextSessionSequence()).isEqualTo(3);
    }

    @Test
    void postponesSettlementDeliveryWhenCurrentSeqLessThanTotalSessionsAndNextNotGenerated() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L); room.setTotalSessions(5);
        var session2 = new ClassSession(); session2.setId(992L); session2.setSequenceNumber(2); session2.setClassRoom(room);
        session2.setAttendanceFinalizedAt(java.time.OffsetDateTime.parse("2026-10-28T00:00:00Z"));

        var a1 = new SessionAttendance(); a1.setStudentId(10L); a1.setFinalOutcome(AttendanceOutcome.TUTOR_ABSENT);

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(session2));
        when(sessions.findById(992L)).thenReturn(Optional.of(session2));
        when(attendances.findBySessionId(992L)).thenReturn(List.of(a1));
        // Only session 2 exists in database so far (rolling generation hasn't generated session 3 yet)
        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(8L)).thenReturn(List.of(session2));

        service.deliverPending();

        // Must NOT dispatch to contract service yet
        verify(dispatcher, never()).dispatchAutoPropose(any(), any(), any(ContractServiceDispatcher.AutoProposePayload.class));
        assertThat(session2.isSettlementDispatched()).isFalse();
    }

    @Test
    void expiredNextSessionIsCapturedAsNoActiveGovernanceWindow() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L); room.setTotalSessions(5);
        var session2 = new ClassSession(); session2.setId(992L); session2.setSequenceNumber(2); session2.setClassRoom(room);
        session2.setAttendanceFinalizedAt(OffsetDateTime.parse("2026-10-30T14:29:53Z"));
        var session3 = new ClassSession(); session3.setId(993L); session3.setSequenceNumber(3); session3.setClassRoom(room);
        session3.setSessionDate(LocalDate.of(2026, 10, 19));
        session3.setStartTime("18:30");
        session3.setStatus(ClassSessionStatus.COMPLETED);
        var attendance = new SessionAttendance(); attendance.setStudentId(10L); attendance.setFinalOutcome(AttendanceOutcome.TUTOR_ABSENT);

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(session2));
        when(sessions.findById(992L)).thenReturn(Optional.of(session2));
        when(attendances.findBySessionId(992L)).thenReturn(List.of(attendance));
        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(8L)).thenReturn(List.of(session2, session3));
        when(dispatcher.dispatchAutoPropose(eq(8L), eq(2L), any(ContractServiceDispatcher.AutoProposePayload.class))).thenReturn(true);

        service.deliverPending();

        var payloadCaptor = ArgumentCaptor.forClass(ContractServiceDispatcher.AutoProposePayload.class);
        verify(dispatcher).dispatchAutoPropose(eq(8L), eq(2L), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().nextSessionSequence()).isNull();
        assertThat(payloadCaptor.getValue().nextSessionStartAt()).isNull();
        assertThat(session2.getGovernanceSnapshotCapturedAt()).isNotNull();
        assertThat(session2.getGovernanceNextSessionSequence()).isNull();
        assertThat(session2.getGovernanceNextSessionStartAt()).isNull();
    }

    @Test
    void terminalSessionCapturesConsistentNoNextSessionSnapshot() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var room = new ClassRoom(); room.setId(8L); room.setTotalSessions(2);
        var terminal = new ClassSession(); terminal.setId(992L); terminal.setSequenceNumber(2); terminal.setClassRoom(room);
        terminal.setAttendanceFinalizedAt(OffsetDateTime.parse("2026-10-30T14:29:53Z"));

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(terminal));
        when(sessions.findById(992L)).thenReturn(Optional.of(terminal));
        when(attendances.findBySessionId(992L)).thenReturn(List.of());
        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(8L)).thenReturn(List.of(terminal));
        when(dispatcher.dispatchAutoPropose(eq(8L), eq(2L), any(ContractServiceDispatcher.AutoProposePayload.class))).thenReturn(true);

        service.deliverPending();

        assertThat(terminal.getGovernanceSnapshotCapturedAt()).isNotNull();
        assertThat(terminal.getGovernanceNextSessionSequence()).isNull();
        assertThat(terminal.getGovernanceNextSessionStartAt()).isNull();
    }

    @Test
    void entityRejectsIncompleteOrExpiredGovernanceSnapshot() {
        var session = new ClassSession();
        session.setSequenceNumber(3);
        session.setAttendanceFinalizedAt(OffsetDateTime.parse("2026-10-30T14:29:53Z"));

        assertThat(org.assertj.core.api.Assertions.catchThrowable(() -> session.captureGovernanceSnapshot(
                OffsetDateTime.parse("2026-10-30T14:30:00Z"), 4, null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(org.assertj.core.api.Assertions.catchThrowable(() -> session.captureGovernanceSnapshot(
                OffsetDateTime.parse("2026-10-30T14:30:00Z"), 4,
                OffsetDateTime.parse("2026-10-19T11:30:00Z"))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(session.getGovernanceSnapshotCapturedAt()).isNull();
    }

    @Test
    void failureForOneSessionDoesNotBlockRemainingDeliveries() {
        var sessions = mock(ClassSessionRepository.class);
        var attendances = mock(SessionAttendanceRepository.class);
        var dispatcher = mock(ContractServiceDispatcher.class);
        var service = newService(sessions, attendances, dispatcher);
        var bad = new ClassSession(); bad.setId(991L);
        var room = new ClassRoom(); room.setId(8L);
        var good = new ClassSession(); good.setId(992L); good.setSequenceNumber(2); good.setClassRoom(room);

        when(sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)).thenReturn(List.of(bad, good));
        when(sessions.findById(991L)).thenThrow(new IllegalStateException("isolated bad session"));
        when(sessions.findById(992L)).thenReturn(Optional.of(good));
        when(attendances.findBySessionId(992L)).thenReturn(List.of());
        when(dispatcher.dispatchAutoPropose(eq(8L), eq(2L), anyList())).thenReturn(true);

        service.deliverPending();

        assertThat(good.isSettlementDispatched()).isTrue();
        verify(dispatcher).dispatchAutoPropose(eq(8L), eq(2L), anyList());
    }

    private static SessionSettlementDeliveryService newService(
            ClassSessionRepository sessions,
            SessionAttendanceRepository attendances,
            ContractServiceDispatcher dispatcher
    ) {
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        return new SessionSettlementDeliveryService(sessions, attendances, dispatcher, transactionManager);
    }
}
