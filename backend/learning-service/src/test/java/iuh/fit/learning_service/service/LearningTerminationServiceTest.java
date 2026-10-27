package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.*;
import iuh.fit.learning_service.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LearningTerminationServiceTest {
    @Mock ClassRoomRepository rooms;
    @Mock ClassSessionRepository sessions;
    @Mock EnrollmentRequestRepository enrollments;
    @Mock LearningTerminationStopRepository stops;
    @Mock SessionAttendanceRepository attendances;
    @Mock RollingSessionService rollingSessions;
    @InjectMocks LearningTerminationService service;
    ClassRoom room;
    EnrollmentRequest enrollment;
    String agreement = UUID.randomUUID().toString();

    @BeforeEach void setup() {
        room = new ClassRoom(); room.setId(1L); room.setStatus(ClassRoomStatus.LOCKED);
        enrollment = new EnrollmentRequest(); enrollment.setClassRoom(room); enrollment.setStudentId(2L);
        enrollment.setStatus(EnrollmentRequestStatus.ENROLLED); enrollment.setAgreementId(agreement);
        when(rooms.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
    }
    ClassSession session(int seq, LocalDateTime start) {
        var s = new ClassSession(); s.setClassRoom(room); s.setSequenceNumber(seq);
        s.setSessionDate(start.toLocalDate()); s.setStartTime(start.toLocalTime().toString()); s.setStatus(ClassSessionStatus.SCHEDULED);
        return s;
    }
    void prepare(List<ClassSession> rows) {
        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(1L)).thenReturn(rows);
        when(enrollments.findByAgreementId(agreement)).thenReturn(Optional.of(enrollment));
    }
    @Test void cancelledClassCannotBeAttendedEvenBeforeCutoff() {
        room.setStatus(ClassRoomStatus.CANCELLED);
        room.setTerminationCutoffSession(5);
        var row = session(3, LocalDateTime.now());
        assertThat(service.isAttendanceStopped(row, null)).isTrue();
        assertThatThrownBy(() -> service.requireCanAttend(row, null))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }

    @Test void individualStopDoesNotStopTutorOrAnotherStudent() {
        var row = session(2, LocalDateTime.now());
        var stop = new LearningTerminationStop(); stop.setCutoffSession(1);
        when(stops.findByClassroomIdAndStudentId(1L, 2L)).thenReturn(List.of(stop));
        assertThat(service.isAttendanceStopped(row, 2L)).isTrue();
        assertThat(service.isAttendanceStopped(row, 3L)).isFalse();
        assertThat(service.isAttendanceStopped(row, null)).isFalse();
        service.requireCanAttend(row, 3L);
        assertThatThrownBy(() -> service.requireCanAttend(row, 2L))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThat(service.isAttendanceStopped(session(1, LocalDateTime.now()), 2L)).isFalse();
    }

    @Test void wholeClassHoldKeepsStartedSessionAvailable() {
        room.setTerminationCutoffSession(1);
        service.requireCanAttend(session(1, LocalDateTime.now()), null);
        assertThat(service.isAttendanceStopped(session(1, LocalDateTime.now()), null)).isFalse();
        assertThat(service.isAttendanceStopped(session(2, LocalDateTime.now()), null)).isTrue();
    }

    @Test void individualFreezePreservesOtherStudentsAndClassSchedule() {
        var past = session(1, LocalDateTime.now().minusHours(1));
        var future = session(2, LocalDateTime.now().plusDays(1));
        prepare(List.of(past, future));
        var snapshot = service.apply(new LearningTerminationService.Command(1L, 2L, agreement, false, "FREEZE"));
        assertThat(snapshot.requiredSessions()).containsExactly(1L);
        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.LOCKED);
        assertThat(future.getStatus()).isEqualTo(ClassSessionStatus.SCHEDULED);
        assertThat(enrollment.getStatus()).isEqualTo(EnrollmentRequestStatus.ENROLLED);
    }
    @Test void individualHoldCanBeReleasedWithoutChangingClassSchedule() {
        var past = session(1, LocalDateTime.now().minusHours(1));
        var future = session(2, LocalDateTime.now().plusDays(1));
        prepare(List.of(past, future));
        var held = service.apply(new LearningTerminationService.Command(1L, 2L, agreement, false, "HOLD"));
        assertThat(held.cutoffSession()).isEqualTo(1);
        assertThat(held.nextSessionStart()).isNotNull();
        assertThat(held.nextSessionStart().getOffset()).isEqualTo(ZoneOffset.ofHours(7));
        var stop = new LearningTerminationStop(); stop.setAgreementId(agreement); stop.setCutoffSession(1);
        when(stops.findById(agreement)).thenReturn(Optional.of(stop));
        service.apply(new LearningTerminationService.Command(1L, 2L, agreement, false, "RELEASE"));
        verify(stops).delete(stop);
        verify(attendances).deleteBySession_IdAndStudentId(future.getId(), 2L);
        verify(rollingSessions).createMissingAttendancesForEnrollment(enrollment);
        assertThat(future.getStatus()).isEqualTo(ClassSessionStatus.SCHEDULED);
    }

    @Test void wholeClassHoldBlocksOperationsButDoesNotCancelFutureSessionUntilApproval() {
        var started = session(1, LocalDateTime.now().minusMinutes(10));
        var future = session(2, LocalDateTime.now().plusDays(1));
        prepare(List.of(started, future));
        service.apply(new LearningTerminationService.Command(1L, 2L, agreement, true, "HOLD"));
        assertThat(room.getTerminationCutoffSession()).isEqualTo(1);
        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.LOCKED);
        assertThat(future.getStatus()).isEqualTo(ClassSessionStatus.SCHEDULED);
    }
    @Test void wholeClassFreezeKeepsStartedSessionAndCancelsFutureSession() {
        var started = session(1, LocalDateTime.now().minusMinutes(10));
        var future = session(2, LocalDateTime.now().plusDays(1));
        prepare(List.of(started, future));
        service.apply(new LearningTerminationService.Command(1L, 2L, agreement, true, "FREEZE"));
        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.LOCKED);
        assertThat(started.getStatus()).isEqualTo(ClassSessionStatus.SCHEDULED);
        assertThat(future.getStatus()).isEqualTo(ClassSessionStatus.CANCELLED);
        assertThat(room.getTerminationCutoffSession()).isEqualTo(1);
        verify(attendances).deleteBySession_Id(future.getId());
    }
    @Test void repeatedFreezeDoesNotMoveIndividualCutoff() {
        prepare(List.of(session(1, LocalDateTime.now().minusDays(1)), session(2, LocalDateTime.now().minusHours(1))));
        var stop = new LearningTerminationStop(); stop.setCutoffSession(1);
        when(stops.findById(agreement)).thenReturn(Optional.of(stop));
        var snapshot = service.apply(new LearningTerminationService.Command(1L, 2L, agreement, false, "FREEZE"));
        assertThat(snapshot.cutoffSession()).isEqualTo(1);
        assertThat(snapshot.requiredSessions()).containsExactly(1L);
        verify(stops, never()).saveAndFlush(any());
    }
    @Test void closureDoesNotExpireEnrollmentOrReopenClass() {
        var future = session(1, LocalDateTime.now().plusDays(1));
        prepare(List.of(future));
        var stop = new LearningTerminationStop(); stop.setCutoffSession(0);
        when(stops.findById(agreement)).thenReturn(Optional.of(stop));
        service.apply(new LearningTerminationService.Command(1L, 2L, agreement, false, "CLOSE"));
        assertThat(enrollment.getStatus()).isEqualTo(EnrollmentRequestStatus.CANCELLED);
        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.LOCKED);
        assertThat(stop.isClosed()).isTrue();
        verify(attendances).deleteBySession_IdAndStudentId(future.getId(), 2L);
    }
    @Test void stopDoesNotBlockOtherStudent() {
        var future = session(3, LocalDateTime.now().plusDays(1));
        var stop = new LearningTerminationStop(); stop.setCutoffSession(2);
        when(stops.findByClassroomIdAndStudentId(1L, 2L)).thenReturn(List.of(stop));
        assertThatThrownBy(() -> service.requireCanAttend(future, 2L)).hasMessageContaining("409");
        assertThatCode(() -> service.requireCanAttend(future, 3L)).doesNotThrowAnyException();
    }

    @Test void trialHoldUsesPersistedRequestedCutoffEvenAfterSecondSessionStarted() {
        room.setTrialPolicyVersion((short) 1);
        room.setTotalSessions(3);
        var first = session(1, LocalDateTime.now().minusDays(2));
        var second = session(2, LocalDateTime.now().minusHours(1));
        prepare(List.of(first, second));
        UUID commandId = UUID.randomUUID();
        OffsetDateTime effectiveAt = OffsetDateTime.parse("2026-10-26T17:59:59+07:00");

        var snapshot = service.apply(new LearningTerminationService.Command(
                1L, 2L, agreement, false, "HOLD", "TRIAL_OPT_OUT",
                1, effectiveAt, commandId));

        assertThat(snapshot.cutoffSession()).isEqualTo(1);
        ArgumentCaptor<LearningTerminationStop> persisted = ArgumentCaptor.forClass(LearningTerminationStop.class);
        verify(stops).saveAndFlush(persisted.capture());
        assertThat(persisted.getValue().getOrigin()).isEqualTo("TRIAL_OPT_OUT");
        assertThat(persisted.getValue().getCommandId()).isEqualTo(commandId);
        assertThat(persisted.getValue().getEffectiveRequestedAt()).isEqualTo(effectiveAt);
        assertThat(persisted.getValue().getCutoffSession()).isEqualTo(1);
        assertThat(persisted.getValue().getCreatedAt()).isNotNull();
        verify(attendances).deleteBySession_IdAndStudentId(second.getId(), 2L);
    }

    @Test void exactTrialCommandReplayIsIdempotentAcrossEquivalentOffsets() {
        room.setTrialPolicyVersion((short) 1);
        room.setTotalSessions(2);
        var first = session(1, LocalDateTime.now().minusDays(1));
        prepare(List.of(first));
        UUID commandId = UUID.randomUUID();
        var stop = new LearningTerminationStop();
        stop.setAgreementId(agreement);
        stop.setOrigin("TRIAL_OPT_OUT");
        stop.setCommandId(commandId);
        stop.setCutoffSession(1);
        stop.setEffectiveRequestedAt(OffsetDateTime.parse("2026-10-26T10:59:59Z"));
        when(stops.findById(agreement)).thenReturn(Optional.of(stop));

        var snapshot = service.apply(new LearningTerminationService.Command(
                1L, 2L, agreement, false, "HOLD", "TRIAL_OPT_OUT",
                1, OffsetDateTime.parse("2026-10-26T17:59:59+07:00"), commandId));

        assertThat(snapshot.cutoffSession()).isEqualTo(1);
        verify(stops, never()).saveAndFlush(any());
        verify(stops, never()).findByCommandId(any());
    }

    @Test void trialReplayCannotChangeCutoffOrCommandIdentity() {
        room.setTrialPolicyVersion((short) 1);
        room.setTotalSessions(3);
        prepare(List.of(session(1, LocalDateTime.now().minusDays(2)),
                session(2, LocalDateTime.now().minusDays(1))));
        var stop = new LearningTerminationStop();
        stop.setAgreementId(agreement);
        stop.setOrigin("TRIAL_OPT_OUT");
        stop.setCommandId(UUID.randomUUID());
        stop.setCutoffSession(1);
        stop.setEffectiveRequestedAt(OffsetDateTime.parse("2026-10-26T10:59:59Z"));
        when(stops.findById(agreement)).thenReturn(Optional.of(stop));

        assertThatThrownBy(() -> service.apply(new LearningTerminationService.Command(
                1L, 2L, agreement, false, "HOLD", "TRIAL_OPT_OUT",
                2, OffsetDateTime.parse("2026-10-26T17:59:59+07:00"), UUID.randomUUID())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("does not match");
        verify(stops, never()).saveAndFlush(any());
    }

    @Test void trialCommandRequiresCompleteAuditFieldsAndPolicyEnrollment() {
        room.setTotalSessions(2);
        prepare(List.of(session(1, LocalDateTime.now().minusDays(1))));

        assertThatThrownBy(() -> service.apply(new LearningTerminationService.Command(
                1L, 2L, agreement, false, "HOLD", "TRIAL_OPT_OUT",
                1, null, UUID.randomUUID())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("requires cutoff");

        assertThatThrownBy(() -> service.apply(new LearningTerminationService.Command(
                1L, 2L, agreement, false, "HOLD", "TRIAL_OPT_OUT",
                1, OffsetDateTime.now(), UUID.randomUUID())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("policy v1");
    }

    @Test void lateFundingRecoveryPersistsStableZeroCutoffBeforeAnyEnrollmentClosure() {
        room.setTrialPolicyVersion((short) 1);
        room.setTotalSessions(2);
        var first = session(1, LocalDateTime.now().minusMinutes(1));
        var second = session(2, LocalDateTime.now().plusDays(2));
        first.setId(101L);
        second.setId(102L);
        prepare(List.of(first, second));
        UUID commandId = UUID.randomUUID();
        OffsetDateTime detectedAt = OffsetDateTime.now(ZoneOffset.UTC);

        var snapshot = service.apply(new LearningTerminationService.Command(
                1L, 2L, agreement, false, "HOLD", "SYSTEM_LATE_FUNDING",
                0, detectedAt, commandId));

        assertThat(snapshot.cutoffSession()).isZero();
        assertThat(snapshot.requiredSessions()).isEmpty();
        ArgumentCaptor<LearningTerminationStop> persisted = ArgumentCaptor.forClass(LearningTerminationStop.class);
        verify(stops).saveAndFlush(persisted.capture());
        assertThat(persisted.getValue().getOrigin()).isEqualTo("SYSTEM_LATE_FUNDING");
        assertThat(persisted.getValue().getCutoffSession()).isZero();
        verify(attendances).deleteBySession_IdAndStudentId(first.getId(), 2L);
        verify(attendances).deleteBySession_IdAndStudentId(second.getId(), 2L);
    }

    @Test void lateFundingRecoveryRejectsAnyNonZeroCutoff() {
        room.setTrialPolicyVersion((short) 1);
        room.setTotalSessions(2);
        prepare(List.of(session(1, LocalDateTime.now().minusMinutes(1))));

        assertThatThrownBy(() -> service.apply(new LearningTerminationService.Command(
                1L, 2L, agreement, false, "HOLD", "SYSTEM_LATE_FUNDING",
                1, OffsetDateTime.now(ZoneOffset.UTC), UUID.randomUUID())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cutoff session 0");
    }
}
