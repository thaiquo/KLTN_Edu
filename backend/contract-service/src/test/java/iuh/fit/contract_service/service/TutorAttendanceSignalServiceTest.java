package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ClassTutorAttendanceSignal;
import iuh.fit.contract_service.repository.ClassTutorAttendanceSignalRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class TutorAttendanceSignalServiceTest {

    private static final OffsetDateTime FINALIZED_AT = OffsetDateTime.parse("2026-10-28T00:00:00Z");

    private final ClassTutorAttendanceSignalRepository repo = mock(ClassTutorAttendanceSignalRepository.class);
    private final TutorAttendanceSignalService service = new TutorAttendanceSignalService(repo);

    @Test
    void successfullyIngestsNewSignal() {
        when(repo.findBySourceEventId("ATTENDANCE:100:1:v1")).thenReturn(Optional.empty());
        when(repo.findByClassroomIdAndSessionSequence(100L, 1)).thenReturn(Optional.empty());

        var signal = new ClassTutorAttendanceSignal();
        signal.setId(UUID.randomUUID());
        signal.setClassroomId(100L);
        signal.setSessionSequence(1);
        signal.setTutorAttendanceOutcome("TUTOR_ABSENT");
        signal.setSourceEventId("ATTENDANCE:100:1:v1");

        when(repo.saveAndFlush(any(ClassTutorAttendanceSignal.class))).thenReturn(signal);

        var result = service.ingest(100L, 501L, 1, "TUTOR_ABSENT", FINALIZED_AT, "ATTENDANCE:100:1:v1", null, null);

        assertThat(result.getSourceEventId()).isEqualTo("ATTENDANCE:100:1:v1");
        assertThat(result.getTutorAttendanceOutcome()).isEqualTo("TUTOR_ABSENT");

        ArgumentCaptor<ClassTutorAttendanceSignal> captor = ArgumentCaptor.forClass(ClassTutorAttendanceSignal.class);
        verify(repo).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getClassroomId()).isEqualTo(100L);
        assertThat(captor.getValue().getSessionSequence()).isEqualTo(1);
        assertThat(captor.getValue().getLearningSessionId()).isEqualTo(501L);
    }

    @Test
    void idempotentReplayReturnsExistingSignalWithoutSaving() {
        var existing = new ClassTutorAttendanceSignal();
        existing.setId(UUID.randomUUID());
        existing.setClassroomId(100L);
        existing.setLearningSessionId(501L);
        existing.setSessionSequence(1);
        existing.setTutorAttendanceOutcome("TUTOR_ABSENT");
        existing.setFinalizedAt(FINALIZED_AT);
        existing.setSourceEventId("ATTENDANCE:100:1:v1");

        when(repo.findBySourceEventId("ATTENDANCE:100:1:v1")).thenReturn(Optional.of(existing));

        var result = service.ingest(100L, 501L, 1, "TUTOR_ABSENT", FINALIZED_AT, "ATTENDANCE:100:1:v1", null, null);

        assertThat(result).isSameAs(existing);
        verify(repo, never()).saveAndFlush(any());
    }

    @Test
    void rejectsPayloadMismatchUnderSameSourceEventId() {
        var existing = new ClassTutorAttendanceSignal();
        existing.setId(UUID.randomUUID());
        existing.setClassroomId(100L);
        existing.setLearningSessionId(501L);
        existing.setSessionSequence(1);
        existing.setTutorAttendanceOutcome("TUTOR_ABSENT");
        existing.setFinalizedAt(FINALIZED_AT);
        existing.setSourceEventId("ATTENDANCE:100:1:v1");

        when(repo.findBySourceEventId("ATTENDANCE:100:1:v1")).thenReturn(Optional.of(existing));

        // Incoming outcome is TUTOR_PRESENT (different!)
        assertThatThrownBy(() -> service.ingest(100L, 501L, 1, "TUTOR_PRESENT", FINALIZED_AT, "ATTENDANCE:100:1:v1", null, null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT")
                .hasMessageContaining("Payload mismatch");
    }

    @Test
    void rejectsConflictingSignalForSameClassroomAndSequenceUnderDifferentEventId() {
        when(repo.findBySourceEventId("ATTENDANCE:100:1:v2")).thenReturn(Optional.empty());

        var existing = new ClassTutorAttendanceSignal();
        existing.setId(UUID.randomUUID());
        existing.setClassroomId(100L);
        existing.setSessionSequence(1);
        existing.setSourceEventId("ATTENDANCE:100:1:v1");

        when(repo.findByClassroomIdAndSessionSequence(100L, 1)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.ingest(100L, 501L, 1, "TUTOR_ABSENT", FINALIZED_AT, "ATTENDANCE:100:1:v2", null, null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT")
                .hasMessageContaining("Different sourceEventId already exists");
    }

    @Test
    void rejectsInvalidSequenceSnapshotAndOversizedEventIdBeforePersistence() {
        assertThatThrownBy(() -> service.ingest(
                100L, 501L, null, "TUTOR_ABSENT", FINALIZED_AT,
                "ATTENDANCE:100:missing:v1", null, null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("sessionSequence")
                .hasMessageContaining("required");

        assertThatThrownBy(() -> service.ingest(
                100L, 501L, 0, "TUTOR_ABSENT", FINALIZED_AT,
                "ATTENDANCE:100:0:v1", null, null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invalid next-session governance snapshot");

        assertThatThrownBy(() -> service.ingest(
                100L, 501L, 1, "TUTOR_ABSENT", FINALIZED_AT,
                "x".repeat(101), 2, FINALIZED_AT))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("exceeds 100 characters");

        assertThatThrownBy(() -> service.ingest(
                100L, 501L, 1, "TUTOR_ABSENT", FINALIZED_AT,
                "ATTENDANCE:100:1:v1", 2, FINALIZED_AT))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invalid next-session governance snapshot");

        verifyNoInteractions(repo);
    }
}
