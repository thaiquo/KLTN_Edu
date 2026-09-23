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
}
