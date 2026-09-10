package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.repository.*;
import org.junit.jupiter.api.Test;
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
}
