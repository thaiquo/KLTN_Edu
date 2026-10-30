package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.TutorAbsenceGovernanceProperties;
import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

import static org.mockito.Mockito.*;

class TerminationSignalsTest {
    final ContractAgreementRepository agreements = mock(ContractAgreementRepository.class);
    final SessionSettlementRepository settlements = mock(SessionSettlementRepository.class);
    final DisputeRepository disputes = mock(DisputeRepository.class);
    final TerminationService service = mock(TerminationService.class);
    final ClassTutorAttendanceSignalRepository attendanceSignals = mock(ClassTutorAttendanceSignalRepository.class);
    final TutorAbsenceProbationRepository probations = mock(TutorAbsenceProbationRepository.class);
    TerminationSignals createSignals(TutorAbsenceGovernanceProperties.Mode mode) {
        var props = new TutorAbsenceGovernanceProperties(mode.name(), "");
        return new TerminationSignals(agreements, settlements, disputes, service, attendanceSignals, probations, props);
    }

    SessionSettlement absent(long sequence) {
        var s = mock(SessionSettlement.class);
        when(s.getSessionId()).thenReturn(sequence);
        when(s.getStatus()).thenReturn(SettlementStatus.REFUNDED);
        lenient().when(s.getOutcome()).thenReturn(SettlementOutcome.TUTOR_ABSENT);
        return s;
    }

    ClassTutorAttendanceSignal signal(long classroomId, int sequence, String outcome) {
        var s = new ClassTutorAttendanceSignal();
        s.setId(UUID.randomUUID());
        s.setClassroomId(classroomId);
        s.setSessionSequence(sequence);
        s.setTutorAttendanceOutcome(outcome);
        s.setFinalizedAt(OffsetDateTime.now(ZoneOffset.UTC));
        s.setSourceEventId("ATTENDANCE:" + classroomId + ":" + sequence + ":v1");
        return s;
    }

    ClassTutorAttendanceSignal signalWithNext(long classroomId, int sequence, String outcome, int nextSequence) {
        var signal = signal(classroomId, sequence, outcome);
        signal.setNextSessionSequence(nextSequence);
        signal.setNextSessionStartAt(OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));
        return signal;
    }

    @Test
    void legacyFallbackTriggersWhenGovernanceIsOff() {
        var signals = new TerminationSignals(agreements, settlements, disputes, service);
        var a = ContractAgreement.builder().id(UUID.randomUUID()).classroomId(1L).build();
        when(agreements.findByStatus(ContractAgreementStatus.ACTIVE)).thenReturn(List.of(a));
        var rows = List.of(absent(1), absent(2), absent(3));
        when(settlements.findByAgreementId(a.getId())).thenReturn(rows);

        signals.detect();

        verify(service).requestSystemReview(eq(a.getId()), eq("TUTOR_ABSENT:1:3"), anyString());
        verifyNoMoreInteractions(service);
    }

    @Test
    void nonconsecutiveAbsencesDoNotTriggerInLegacyMode() {
        var signals = new TerminationSignals(agreements, settlements, disputes, service);
        var a = ContractAgreement.builder().id(UUID.randomUUID()).classroomId(1L).build();
        when(agreements.findByStatus(ContractAgreementStatus.ACTIVE)).thenReturn(List.of(a));
        var rows = List.of(absent(1), absent(3), absent(5));
        when(settlements.findByAgreementId(a.getId())).thenReturn(rows);

        signals.detect();

        verifyNoInteractions(service);
    }

    @Test
    void threeConsecutiveAbsencesAtClassLevelTriggerGovernanceCaseWhenEnforce() {
        var signals = createSignals(TutorAbsenceGovernanceProperties.Mode.ENFORCE);
        long classroomId = 88L;

        var trigger = signalWithNext(classroomId, 3, "TUTOR_ABSENT", 4);
        when(attendanceSignals.findByClassroomIdOrderBySessionSequenceAsc(classroomId)).thenReturn(List.of(
                signal(classroomId, 1, "TUTOR_ABSENT"),
                signal(classroomId, 2, "TUTOR_ABSENT"),
                trigger
        ));
        when(attendanceSignals.findByClassroomIdAndSessionSequence(classroomId, 3)).thenReturn(Optional.of(trigger));
        when(probations.findActiveByClassroomIdForUpdate(classroomId)).thenReturn(Optional.empty());

        signals.detectForClassroom(classroomId, 4, OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));

        verify(service).requestAbsenceGovernanceCase(eq(classroomId), eq(3), eq(4), any());
    }

    @Test
    void shadowModeComputesCandidateWithoutTriggeringCase() {
        var signals = createSignals(TutorAbsenceGovernanceProperties.Mode.SHADOW);
        long classroomId = 88L;

        var trigger = signalWithNext(classroomId, 3, "TUTOR_ABSENT", 4);
        when(attendanceSignals.findByClassroomIdOrderBySessionSequenceAsc(classroomId)).thenReturn(List.of(
                signal(classroomId, 1, "TUTOR_ABSENT"),
                signal(classroomId, 2, "TUTOR_ABSENT"),
                trigger
        ));
        when(attendanceSignals.findByClassroomIdAndSessionSequence(classroomId, 3)).thenReturn(Optional.of(trigger));
        when(probations.findActiveByClassroomIdForUpdate(classroomId)).thenReturn(Optional.empty());

        signals.detectForClassroom(classroomId, 4, OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));

        verify(service, never()).requestAbsenceGovernanceCase(anyLong(), anyInt(), any(), any());
    }

    @Test
    void sequenceGapBreaksConsecutiveAbsenceStreak() {
        var signals = createSignals(TutorAbsenceGovernanceProperties.Mode.ENFORCE);
        long classroomId = 88L;

        // Sequences 1, 3, 4: gap between 1 and 3 -> streak is only 2 (3 and 4)
        when(attendanceSignals.findByClassroomIdOrderBySessionSequenceAsc(classroomId)).thenReturn(List.of(
                signal(classroomId, 1, "TUTOR_ABSENT"),
                signal(classroomId, 3, "TUTOR_ABSENT"),
                signal(classroomId, 4, "TUTOR_ABSENT")
        ));
        when(probations.findActiveByClassroomIdForUpdate(classroomId)).thenReturn(Optional.empty());

        signals.detectForClassroom(classroomId, 5, OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));

        verify(service, never()).requestAbsenceGovernanceCase(anyLong(), anyInt(), any(), any());
    }

    @Test
    void presentOrInconsistentResetsAbsenceStreak() {
        var signals = createSignals(TutorAbsenceGovernanceProperties.Mode.ENFORCE);
        long classroomId = 88L;

        // Sequence 2 was TUTOR_PRESENT
        when(attendanceSignals.findByClassroomIdOrderBySessionSequenceAsc(classroomId)).thenReturn(List.of(
                signal(classroomId, 1, "TUTOR_ABSENT"),
                signal(classroomId, 2, "TUTOR_PRESENT"),
                signal(classroomId, 3, "TUTOR_ABSENT"),
                signal(classroomId, 4, "TUTOR_ABSENT")
        ));
        when(probations.findActiveByClassroomIdForUpdate(classroomId)).thenReturn(Optional.empty());

        signals.detectForClassroom(classroomId, 5, OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));

        verify(service, never()).requestAbsenceGovernanceCase(anyLong(), anyInt(), any(), any());
    }

    @Test
    void activeProbationTutorAbsentTriggersRelapse() {
        var signals = createSignals(TutorAbsenceGovernanceProperties.Mode.ENFORCE);
        long classroomId = 88L;

        var probation = new TutorAbsenceProbation();
        probation.setId(UUID.randomUUID());
        probation.setClassroomId(classroomId);
        probation.setSessionSequence(4);
        probation.setStatus("ACTIVE");

        when(probations.findActiveByClassroomIdForUpdate(classroomId)).thenReturn(Optional.of(probation));
        var relapseSignal = signal(classroomId, 4, "TUTOR_ABSENT");
        when(attendanceSignals.findByClassroomIdAndSessionSequence(classroomId, 4)).thenReturn(Optional.of(relapseSignal));

        signals.detectForClassroom(classroomId, 5, OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));

        verify(service).requestAbsenceGovernanceRelapse(eq(classroomId), eq(probation), eq(relapseSignal));
        verify(service, never()).requestAbsenceGovernanceCase(anyLong(), anyInt(), any(), any());
    }

    @Test
    void activeProbationTutorPresentMarksProbationPassed() {
        var signals = createSignals(TutorAbsenceGovernanceProperties.Mode.ENFORCE);
        long classroomId = 88L;

        var probation = new TutorAbsenceProbation();
        probation.setId(UUID.randomUUID());
        probation.setClassroomId(classroomId);
        probation.setSessionSequence(4);
        probation.setStatus("ACTIVE");

        when(probations.findActiveByClassroomIdForUpdate(classroomId)).thenReturn(Optional.of(probation));
        var passedSignal = signal(classroomId, 4, "TUTOR_PRESENT");
        when(attendanceSignals.findByClassroomIdAndSessionSequence(classroomId, 4)).thenReturn(Optional.of(passedSignal));

        signals.detectForClassroom(classroomId, 5, OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));

        verify(probations).saveAndFlush(argThat(p -> "PASSED".equals(p.getStatus()) && p.getResolvedAt() != null));
        verify(service, never()).requestAbsenceGovernanceRelapse(any(), any(), any());
    }

    @Test
    void shadowModeNeverMutatesActiveProbation() {
        var signals = createSignals(TutorAbsenceGovernanceProperties.Mode.SHADOW);
        long classroomId = 88L;

        var probation = new TutorAbsenceProbation();
        probation.setId(UUID.randomUUID());
        probation.setClassroomId(classroomId);
        probation.setActiveClassroomGuard(classroomId);
        probation.setSessionSequence(4);
        probation.setStatus("ACTIVE");

        when(probations.findActiveByClassroomIdForUpdate(classroomId)).thenReturn(Optional.of(probation));
        when(attendanceSignals.findByClassroomIdAndSessionSequence(classroomId, 4))
                .thenReturn(Optional.of(signal(classroomId, 4, "TUTOR_PRESENT")));

        signals.detectForClassroom(classroomId, null, null);

        verify(probations, never()).saveAndFlush(any());
        verifyNoInteractions(service);
        org.junit.jupiter.api.Assertions.assertEquals("ACTIVE", probation.getStatus());
        org.junit.jupiter.api.Assertions.assertEquals(classroomId, probation.getActiveClassroomGuard());
    }
}
