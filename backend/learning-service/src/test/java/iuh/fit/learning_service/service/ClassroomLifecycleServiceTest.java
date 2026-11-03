package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClassroomLifecycleServiceTest {

    @Mock
    private ClassRoomRepository classRoomRepository;

    @Mock
    private EnrollmentRequestRepository enrollmentRequestRepository;

    @Mock
    private ClassSessionRepository classSessionRepository;

    @Mock
    private SessionAttendanceRepository sessionAttendanceRepository;

    @Mock
    private RollingSessionService rollingSessionService;

    @Mock
    private RealtimeEventHub realtimeEventHub;

    private ClassroomLifecycleService lifecycleService;

    @BeforeEach
    void setUp() {
        lifecycleService = new ClassroomLifecycleService(
                classRoomRepository,
                enrollmentRequestRepository,
                classSessionRepository,
                sessionAttendanceRepository,
                rollingSessionService,
                realtimeEventHub
        );
    }

    private ClassRoom createClassRoom(Long id, ClassRoomStatus status, LocalDate startDate) {
        ClassRoom room = new ClassRoom();
        ReflectionTestUtils.setField(room, "id", id);
        room.setName("Toán 10 Cơ Bản");
        room.setTutorEmail("tutor@example.com");
        room.setStatus(status);
        room.setStartDate(startDate);
        return room;
    }

    @Test
    void publishedClassWithZeroEffectiveStudentsClosesWithoutGeneratingSessions() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = createClassRoom(1L, ClassRoomStatus.PUBLISHED, today);

        EnrollmentRequest pendingReq = new EnrollmentRequest();
        pendingReq.setClassRoom(room);
        pendingReq.setStatus(EnrollmentRequestStatus.PENDING);

        ClassSession scheduledSession = new ClassSession();
        ReflectionTestUtils.setField(scheduledSession, "id", 101L);
        scheduledSession.setClassRoom(room);
        scheduledSession.setSequenceNumber(1);
        scheduledSession.setStatus(ClassSessionStatus.SCHEDULED);

        when(classRoomRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatusIn(eq(1L), any())).thenReturn(0L);
        when(enrollmentRequestRepository.findByClassRoomIdAndStatus(1L, EnrollmentRequestStatus.PENDING))
                .thenReturn(List.of(pendingReq));
        when(classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(1L))
                .thenReturn(List.of(scheduledSession));

        lifecycleService.processStartingClassroom(1L, today);

        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.CLOSED);
        verify(classRoomRepository).save(room);
        verify(rollingSessionService, never()).generateInitialWeekSessions(anyLong());

        assertThat(pendingReq.getStatus()).isEqualTo(EnrollmentRequestStatus.CANCELLED);
        assertThat(pendingReq.getRejectReason()).contains("Lớp tự đóng do không có học viên");
        verify(enrollmentRequestRepository).save(pendingReq);

        assertThat(scheduledSession.getStatus()).isEqualTo(ClassSessionStatus.CANCELLED);
        verify(classSessionRepository).save(scheduledSession);
        verify(sessionAttendanceRepository).deleteBySession_Id(101L);

        verify(realtimeEventHub).publishToUser(eq("tutor@example.com"), eq("CLASS_AUTO_CLOSED"), eq(1L), any());
    }

    @Test
    void publishedClassWithEnrolledStudentLocksAndGeneratesInitialSessions() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = createClassRoom(2L, ClassRoomStatus.PUBLISHED, today);

        when(classRoomRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(room));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatusIn(eq(2L), any())).thenReturn(1L);

        lifecycleService.processStartingClassroom(2L, today);

        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.LOCKED);
        verify(classRoomRepository).save(room);
        verify(rollingSessionService).generateInitialWeekSessions(2L);
        verify(realtimeEventHub, never()).publishToUser(any(), eq("CLASS_AUTO_CLOSED"), any(), any());
    }

    @Test
    void publishedClassWithAcceptedStudentLocksAndGeneratesInitialSessions() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = createClassRoom(3L, ClassRoomStatus.PUBLISHED, today);

        // 1 ACCEPTED student in pipeline
        when(classRoomRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(room));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatusIn(eq(3L), any())).thenReturn(1L);

        lifecycleService.processStartingClassroom(3L, today);

        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.LOCKED);
        verify(classRoomRepository).save(room);
        verify(rollingSessionService).generateInitialWeekSessions(3L);
    }

    @Test
    void activeClassWithStudentsKeepsActiveStatusAndGeneratesInitialSessions() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = createClassRoom(4L, ClassRoomStatus.ACTIVE, today);

        when(classRoomRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(room));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatusIn(eq(4L), any())).thenReturn(2L);

        lifecycleService.processStartingClassroom(4L, today);

        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.ACTIVE);
        verify(rollingSessionService).generateInitialWeekSessions(4L);
    }

    @Test
    void classroomStartingInFutureIsSkipped() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = createClassRoom(5L, ClassRoomStatus.PUBLISHED, today.plusDays(2));

        when(classRoomRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(room));

        lifecycleService.processStartingClassroom(5L, today);

        assertThat(room.getStatus()).isEqualTo(ClassRoomStatus.PUBLISHED);
        verify(classRoomRepository, never()).save(any());
        verify(rollingSessionService, never()).generateInitialWeekSessions(anyLong());
    }

    @Test
    void alreadyClosedClassroomIsSkipped() {
        LocalDate today = LocalDate.of(2026, 11, 3);
        ClassRoom room = createClassRoom(6L, ClassRoomStatus.CLOSED, today);

        when(classRoomRepository.findByIdForUpdate(6L)).thenReturn(Optional.of(room));

        lifecycleService.processStartingClassroom(6L, today);

        verify(classRoomRepository, never()).save(any());
        verify(rollingSessionService, never()).generateInitialWeekSessions(anyLong());
    }
}

