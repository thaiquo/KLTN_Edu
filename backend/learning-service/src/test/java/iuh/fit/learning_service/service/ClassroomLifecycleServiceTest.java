package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClassroomLifecycleServiceTest {

    @Mock private ClassRoomRepository classRoomRepository;
    @Mock private EnrollmentRequestRepository enrollmentRequestRepository;
    @Mock private ClassSessionRepository classSessionRepository;
    @Mock private SessionAttendanceRepository sessionAttendanceRepository;
    @Mock private RollingSessionService rollingSessionService;
    @Mock private RealtimeEventHub realtimeEventHub;
    @Mock private LearningEventPublisher eventPublisher;

    private ClassroomLifecycleService lifecycleService;

    @BeforeEach
    void setUp() {
        lifecycleService = new ClassroomLifecycleService(
                classRoomRepository,
                enrollmentRequestRepository,
                classSessionRepository,
                sessionAttendanceRepository,
                rollingSessionService,
                realtimeEventHub,
                eventPublisher
        );
    }

    @Test
    void publishedClassWithZeroEffectiveStudentsClosesAndCancelsOnlyFutureScheduledSessions() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = classroom(1L, ClassRoomStatus.PUBLISHED, today);
        EnrollmentRequest pending = pendingRequest(501L, 100L, room);
        ClassSession futureScheduled = session(101L, room, ClassSessionStatus.SCHEDULED, today);
        ClassSession pastScheduled = session(102L, room, ClassSessionStatus.SCHEDULED, today.minusDays(1));
        ClassSession inProgress = session(103L, room, ClassSessionStatus.IN_PROGRESS, today);

        when(classRoomRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                1L, List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED))).thenReturn(0L);
        when(enrollmentRequestRepository.findByClassRoomIdAndStatus(1L, EnrollmentRequestStatus.PENDING))
                .thenReturn(List.of(pending));
        when(classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(1L))
                .thenReturn(List.of(futureScheduled, pastScheduled, inProgress));

        lifecycleService.processStartingClassroom(1L, today);

        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.CLOSED);
        assertThat(pending.getStatus()).isEqualTo(EnrollmentRequestStatus.CANCELLED);
        assertThat(pending.getRejectReason()).contains("không có học viên");
        assertThat(futureScheduled.getStatus()).isEqualTo(ClassSessionStatus.CANCELLED);
        assertThat(pastScheduled.getStatus()).isEqualTo(ClassSessionStatus.SCHEDULED);
        assertThat(inProgress.getStatus()).isEqualTo(ClassSessionStatus.IN_PROGRESS);

        verify(eventPublisher).publishEnrollmentSystemCancelled(
                501L, 1L, 100L, "Toán 10", pending.getRejectReason(), "An");
        verify(classSessionRepository).save(futureScheduled);
        verify(classSessionRepository, never()).save(pastScheduled);
        verify(classSessionRepository, never()).save(inProgress);
        verify(sessionAttendanceRepository).deleteBySession_Id(101L);
        verify(sessionAttendanceRepository, never()).deleteBySession_Id(102L);
        verify(sessionAttendanceRepository, never()).deleteBySession_Id(103L);
        verify(rollingSessionService, never()).generateInitialWeekSessions(anyLong());
        verify(realtimeEventHub).publishToUser(
                eq("tutor@example.com"), eq("CLASS_AUTO_CLOSED"), eq(1L), any());
    }

    @Test
    void publishedClassWithEffectiveStudentLocksCancelsPendingAndThenGeneratesSessions() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = classroom(2L, ClassRoomStatus.PUBLISHED, today);
        EnrollmentRequest pending = pendingRequest(502L, 101L, room);

        when(classRoomRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(room));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                2L, List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED))).thenReturn(1L);
        when(enrollmentRequestRepository.findByClassRoomIdAndStatus(2L, EnrollmentRequestStatus.PENDING))
                .thenReturn(List.of(pending));

        lifecycleService.processStartingClassroom(2L, today);

        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.LOCKED);
        assertThat(pending.getStatus()).isEqualTo(EnrollmentRequestStatus.CANCELLED);
        verify(eventPublisher).publishEnrollmentSystemCancelled(
                502L, 2L, 101L, "Toán 10", pending.getRejectReason(), "An");
        InOrder order = inOrder(classRoomRepository, enrollmentRequestRepository, rollingSessionService);
        order.verify(classRoomRepository).save(room);
        order.verify(enrollmentRequestRepository).save(pending);
        order.verify(rollingSessionService).generateInitialWeekSessions(2L);
        verify(realtimeEventHub, never()).publishToUser(any(), eq("CLASS_AUTO_CLOSED"), any(), any());
    }

    @Test
    void activeLegacyClassIsNeverAutoClosedFromLearningEnrollmentRows() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = classroom(3L, ClassRoomStatus.ACTIVE, today);
        when(classRoomRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(room));

        lifecycleService.processStartingClassroom(3L, today);

        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.ACTIVE);
        verify(enrollmentRequestRepository, never()).countByClassRoomIdAndStatusIn(anyLong(), any());
        verify(classRoomRepository, never()).save(any());
        verify(rollingSessionService).generateInitialWeekSessions(3L);
    }

    @Test
    void terminatingClassroomIsSkipped() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = classroom(4L, ClassRoomStatus.PUBLISHED, today);
        room.setTerminationCutoffSession(2);
        when(classRoomRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(room));

        lifecycleService.processStartingClassroom(4L, today);

        verify(enrollmentRequestRepository, never()).countByClassRoomIdAndStatusIn(anyLong(), any());
        verify(classRoomRepository, never()).save(any());
        verify(rollingSessionService, never()).generateInitialWeekSessions(anyLong());
    }

    @Test
    void classroomStartingInFutureIsSkipped() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = classroom(5L, ClassRoomStatus.PUBLISHED, today.plusDays(1));
        when(classRoomRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(room));

        lifecycleService.processStartingClassroom(5L, today);

        verify(classRoomRepository, never()).save(any());
        verify(rollingSessionService, never()).generateInitialWeekSessions(anyLong());
    }

    @Test
    void nonEligibleStatusIsSkipped() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = classroom(6L, ClassRoomStatus.CLOSED, today);
        when(classRoomRepository.findByIdForUpdate(6L)).thenReturn(Optional.of(room));

        lifecycleService.processStartingClassroom(6L, today);

        verify(classRoomRepository, never()).save(any());
        verify(rollingSessionService, never()).generateInitialWeekSessions(anyLong());
    }

    private ClassRoom classroom(Long id, ClassRoomStatus status, LocalDate startDate) {
        ClassRoom room = new ClassRoom();
        ReflectionTestUtils.setField(room, "id", id);
        room.setName("Toán 10");
        room.setTutorEmail("tutor@example.com");
        room.setStatus(status);
        room.setStartDate(startDate);
        return room;
    }

    private EnrollmentRequest pendingRequest(Long id, Long studentId, ClassRoom room) {
        EnrollmentRequest request = new EnrollmentRequest();
        ReflectionTestUtils.setField(request, "id", id);
        request.setClassRoom(room);
        request.setStudentId(studentId);
        request.setStudentName("An");
        request.setStatus(EnrollmentRequestStatus.PENDING);
        return request;
    }

    private ClassSession session(
            Long id,
            ClassRoom room,
            ClassSessionStatus status,
            LocalDate sessionDate
    ) {
        ClassSession session = new ClassSession();
        ReflectionTestUtils.setField(session, "id", id);
        session.setClassRoom(room);
        session.setSequenceNumber(id.intValue());
        session.setSessionDate(sessionDate);
        session.setStatus(status);
        return session;
    }
}
