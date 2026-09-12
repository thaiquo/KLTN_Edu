package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RollingSessionServiceTest {
    private final ClassRoomRepository rooms = mock(ClassRoomRepository.class);
    private final ClassSessionRepository sessions = mock(ClassSessionRepository.class);
    private final EnrollmentRequestRepository enrollments = mock(EnrollmentRequestRepository.class);
    private final SessionAttendanceRepository attendances = mock(SessionAttendanceRepository.class);
    private final RollingSessionService service = new RollingSessionService(rooms, sessions, enrollments, attendances);

    private ClassRoom room() {
        ClassRoom room = new ClassRoom();
        room.setId(1L);
        room.setTotalSessions(6);
        room.setSessionsPerWeek(3);
        when(rooms.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
        return room;
    }

    private ClassSession session(int sequence, ClassSessionStatus status) {
        ClassSession session = new ClassSession();
        session.setSequenceNumber(sequence);
        session.setStatus(status);
        session.setSessionDate(LocalDate.of(2026, 9, 7).plusDays(sequence - 1));
        return session;
    }

    @Test
    void finishingFirstSessionDoesNotGenerateNextWeek() {
        room();
        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(1L)).thenReturn(List.of(
                session(1, ClassSessionStatus.COMPLETED), session(2, ClassSessionStatus.SCHEDULED),
                session(3, ClassSessionStatus.SCHEDULED)));
        assertThat(service.generateNextBatchIfNeeded(1L)).isEmpty();
        verify(sessions, never()).save(any());
        verifyNoInteractions(enrollments, attendances);
    }

    @Test
    void emptyScheduleAfterCompletedWeekDoesNotLoopOrCreateSessions() {
        room().setSchedules(List.of());
        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(1L)).thenReturn(List.of(
                session(1, ClassSessionStatus.COMPLETED), session(2, ClassSessionStatus.COMPLETED),
                session(3, ClassSessionStatus.COMPLETED)));
        assertThat(service.generateNextBatchIfNeeded(1L)).isEmpty();
        verify(sessions, never()).save(any());
    }

    @Test
    void completedCourseDoesNotGenerateMoreSessions() {
        room().setTotalSessions(1);
        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(1L)).thenReturn(List.of(session(1, ClassSessionStatus.COMPLETED)));
        assertThat(service.generateNextBatchIfNeeded(1L)).isEmpty();
        verify(sessions, never()).save(any());
    }

    @Test
    void activationCreatesMissingAttendancesOnlyForOpenSessions() {
        ClassRoom room = room();
        room.setTutorProfileId(77L);
        EnrollmentRequest enrollment = new EnrollmentRequest();
        enrollment.setClassRoom(room);
        enrollment.setStudentId(100L);
        enrollment.setStudentEmail("student@example.com");
        enrollment.setStudentName("Student Demo");

        ClassSession scheduled = session(1, ClassSessionStatus.SCHEDULED);
        ReflectionTestUtils.setField(scheduled, "id", 10L);
        ClassSession completed = session(2, ClassSessionStatus.COMPLETED);
        ReflectionTestUtils.setField(completed, "id", 11L);
        ClassSession existing = session(3, ClassSessionStatus.SCHEDULED);
        ReflectionTestUtils.setField(existing, "id", 12L);

        when(sessions.findByClassRoomIdOrderBySequenceNumberAsc(1L))
                .thenReturn(List.of(scheduled, completed, existing));
        when(attendances.findBySessionIdAndStudentId(10L, 100L)).thenReturn(Optional.empty());
        when(attendances.findBySessionIdAndStudentId(12L, 100L))
                .thenReturn(Optional.of(new SessionAttendance()));

        int created = service.createMissingAttendancesForEnrollment(enrollment);

        assertThat(created).isEqualTo(1);
        verify(attendances).save(argThat(attendance ->
                attendance.getSession() == scheduled
                        && attendance.getStudentId().equals(100L)
                        && attendance.getTutorId().equals(77L)
                        && !attendance.getStudentChecked()
                        && !attendance.getTutorChecked()));
    }
}
