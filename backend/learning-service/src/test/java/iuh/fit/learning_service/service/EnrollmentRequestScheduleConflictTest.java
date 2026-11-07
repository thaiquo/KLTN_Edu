package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.EnrollClassRequest;
import iuh.fit.learning_service.dto.EnrollmentRequestDtos.StudentScheduleResponse;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.entity.LearningTerminationStop;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.StudentScheduleConflictException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.LearningTerminationStopRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class EnrollmentRequestScheduleConflictTest {

    private static final String WALLET = "0x0000000000000000000000000000000000000001";

    @Mock
    private ClassRoomRepository classRoomRepository;

    @Mock
    private EnrollmentRequestRepository enrollmentRequestRepository;

    @Mock
    private ClassSessionRepository classSessionRepository;

    @Mock
    private TutorAuthorizationStateRepository tutorAuthorizationStateRepository;

    @Mock
    private LearningEventPublisher eventPublisher;

    @Mock
    private RollingSessionService rollingSessionService;

    @Mock
    private LearningTerminationStopRepository terminationStops;

    @Mock
    private StudentScheduleGuard studentScheduleGuard;

    @Test
    void rejectsEnrollmentWhenScheduleConflictsWithActiveEnrolledClass() {
        EnrollmentRequestService service = service();

        // Target classroom: Mon (day 2) 18:00 - 19:30
        ClassRoom targetClass = createClassRoom(10L, "Toán Lớp 10 Nâng Cao", LocalDate.now(), LocalDate.now().plusMonths(2));
        ClassSchedule targetSlot = createSchedule(targetClass, 2, "18:00", "19:30");
        targetClass.setSchedules(List.of(targetSlot));

        // Existing enrolled class: Mon (day 2) 19:00 - 20:30 (overlaps with 18:00-19:30)
        ClassRoom existingClass = createClassRoom(20L, "Vật Lý 10 Cơ Bản", LocalDate.now(), LocalDate.now().plusMonths(2));
        ClassSchedule existingSlot = createSchedule(existingClass, 2, "19:00", "20:30");
        existingClass.setSchedules(List.of(existingSlot));

        EnrollmentRequest acceptedReq = new EnrollmentRequest();
        acceptedReq.setClassRoom(existingClass);
        acceptedReq.setStudentEmail("student@example.com");
        acceptedReq.setStatus(EnrollmentRequestStatus.ACCEPTED);

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any())).thenReturn(false);
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com")).thenReturn(List.of(acceptedReq));

        EnrollClassRequest request = validRequest();

        assertThatThrownBy(() -> service.enrollClass(10L, 100L, "student@example.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Trùng lịch học")
                .hasMessageContaining("Vật Lý 10 Cơ Bản");
    }

    @Test
    void rejectsEnrollmentWhileExistingClassHasPendingTerminationCutoff() {
        EnrollmentRequestService service = service();

        // Target classroom: Mon (day 2) 18:00 - 19:30
        ClassRoom targetClass = createClassRoom(10L, "Toán Lớp 10 Nâng Cao", LocalDate.now(), LocalDate.now().plusMonths(2));
        ClassSchedule targetSlot = createSchedule(targetClass, 2, "18:00", "19:30");
        targetClass.setSchedules(List.of(targetSlot));

        // HOLD has a cutoff, but Admin can still reject the cancellation.
        ClassRoom existingClass = createClassRoom(20L, "Vật Lý 10 Cơ Bản", LocalDate.now(), LocalDate.now().plusMonths(2));
        existingClass.setStatus(ClassRoomStatus.LOCKED);
        existingClass.setTerminationCutoffSession(5);
        ClassSchedule existingSlot = createSchedule(existingClass, 2, "18:00", "19:30");
        existingClass.setSchedules(List.of(existingSlot));

        EnrollmentRequest acceptedReq = new EnrollmentRequest();
        acceptedReq.setClassRoom(existingClass);
        acceptedReq.setStudentEmail("student@example.com");
        acceptedReq.setStatus(EnrollmentRequestStatus.ENROLLED);

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any())).thenReturn(false);
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com")).thenReturn(List.of(acceptedReq));

        EnrollClassRequest request = validRequest();
        assertThatThrownBy(() -> service.enrollClass(10L, 100L, "student@example.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Trùng lịch học");
    }

    @Test
    void pendingRequestImmediatelyReservesStudentSchedule() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Hóa học", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 7, "13:00", "14:30")));

        ClassRoom pendingClass = createClassRoom(20L, "Toán học", LocalDate.now(), LocalDate.now().plusMonths(2));
        pendingClass.setSchedules(List.of(createSchedule(pendingClass, 7, "13:00", "14:30")));
        EnrollmentRequest pending = new EnrollmentRequest();
        ReflectionTestUtils.setField(pending, "id", 2L);
        pending.setClassRoom(pendingClass);
        pending.setStudentId(100L);
        pending.setStudentEmail("student@example.com");
        pending.setStatus(EnrollmentRequestStatus.PENDING);

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any())).thenReturn(false);
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com")).thenReturn(List.of(pending));

        assertThatThrownBy(() -> service.enrollClass(10L, 100L, "student@example.com", validRequest()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Toán học");
    }

    @Test
    void tutorAcceptanceRechecksConflictBeforeChangingStatus() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Hóa học", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 7, "13:00", "14:30")));
        EnrollmentRequest target = new EnrollmentRequest();
        ReflectionTestUtils.setField(target, "id", 1L);
        target.setClassRoom(targetClass);
        target.setStudentId(100L);
        target.setStudentEmail("student@example.com");
        target.setStatus(EnrollmentRequestStatus.PENDING);

        ClassRoom existingClass = createClassRoom(20L, "Toán học", LocalDate.now(), LocalDate.now().plusMonths(2));
        existingClass.setSchedules(List.of(createSchedule(existingClass, 7, "13:00", "14:30")));
        EnrollmentRequest existing = new EnrollmentRequest();
        ReflectionTestUtils.setField(existing, "id", 2L);
        existing.setClassRoom(existingClass);
        existing.setStudentId(100L);
        existing.setStudentEmail("student@example.com");
        existing.setStatus(EnrollmentRequestStatus.ACCEPTED);

        when(enrollmentRequestRepository.findClassRoomIdById(1L)).thenReturn(Optional.of(10L));
        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.findById(1L)).thenReturn(Optional.of(target));
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com"))
                .thenReturn(List.of(target, existing));

        assertThatThrownBy(() -> service.acceptRequest(1L, "tutor@example.com", 200L, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Toán học");
        verify(enrollmentRequestRepository, never()).save(target);
        verify(eventPublisher, never()).publishEnrollmentAccepted(any(), any(), any(), any(), any(), any());
    }

    @Test
    void escrowActivationRechecksConflictBeforeEnrollmentAndAttendance() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Hóa học", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 7, "13:00", "14:30")));
        EnrollmentRequest target = new EnrollmentRequest();
        ReflectionTestUtils.setField(target, "id", 1L);
        target.setClassRoom(targetClass);
        target.setStudentId(100L);
        target.setStudentEmail("student@example.com");
        target.setAgreementId("agreement-1");
        target.setStatus(EnrollmentRequestStatus.ACCEPTED);

        ClassRoom existingClass = createClassRoom(20L, "Toán học", LocalDate.now(), LocalDate.now().plusMonths(2));
        existingClass.setSchedules(List.of(createSchedule(existingClass, 7, "13:00", "14:30")));
        EnrollmentRequest existing = new EnrollmentRequest();
        ReflectionTestUtils.setField(existing, "id", 2L);
        existing.setClassRoom(existingClass);
        existing.setStudentId(100L);
        existing.setStudentEmail("student@example.com");
        existing.setStatus(EnrollmentRequestStatus.ENROLLED);

        when(enrollmentRequestRepository.findByAgreementId("agreement-1")).thenReturn(Optional.of(target));
        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com"))
                .thenReturn(List.of(target, existing));

        assertThatThrownBy(() -> service.activateEnrollment(10L, 100L, "agreement-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Toán học");
        verify(enrollmentRequestRepository, never()).save(target);
        verify(rollingSessionService, never()).createMissingAttendancesForEnrollment(any());
    }

    @Test
    void individualTerminationHoldStillReservesStudentSchedule() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Toán Lớp 10 Nâng Cao", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 2, "18:00", "19:30")));

        ClassRoom existingClass = createClassRoom(20L, "Vật Lý 10 Cơ Bản", LocalDate.now(), LocalDate.now().plusMonths(2));
        existingClass.setSchedules(List.of(createSchedule(existingClass, 2, "18:00", "19:30")));
        EnrollmentRequest enrollment = new EnrollmentRequest();
        enrollment.setClassRoom(existingClass);
        enrollment.setStudentId(100L);
        enrollment.setStudentEmail("student@example.com");
        enrollment.setStatus(EnrollmentRequestStatus.ENROLLED);
        LearningTerminationStop hold = new LearningTerminationStop();
        hold.setClassroomId(20L);
        hold.setStudentId(100L);
        hold.setCutoffSession(1);

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any())).thenReturn(false);
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com")).thenReturn(List.of(enrollment));
        lenient().when(terminationStops.findByClassroomIdAndStudentId(20L, 100L)).thenReturn(List.of(hold));

        assertThatThrownBy(() -> service.enrollClass(10L, 100L, "student@example.com", validRequest()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Trùng lịch học");
    }

    @Test
    void allowsEnrollmentAfterExistingClassIsCancelled() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Toán Lớp 10 Nâng Cao", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 2, "18:00", "19:30")));

        ClassRoom oldClass = createClassRoom(20L, "Vật Lý 10 Cơ Bản", LocalDate.now(), LocalDate.now().plusMonths(2));
        oldClass.setStatus(ClassRoomStatus.CANCELLED);
        oldClass.setTerminationCutoffSession(5);
        oldClass.setSchedules(List.of(createSchedule(oldClass, 2, "18:00", "19:30")));
        EnrollmentRequest oldEnrollment = new EnrollmentRequest();
        oldEnrollment.setClassRoom(oldClass);
        oldEnrollment.setStudentEmail("student@example.com");
        oldEnrollment.setStatus(EnrollmentRequestStatus.CANCELLED);

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.PENDING)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any())).thenReturn(false);
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com")).thenReturn(List.of(oldEnrollment));
        when(enrollmentRequestRepository.save(any())).thenAnswer(i -> {
            EnrollmentRequest r = i.getArgument(0);
            ReflectionTestUtils.setField(r, "id", 1L);
            return r;
        });

        assertThat(service.enrollClass(10L, 100L, "student@example.com", validRequest())).isNotNull();
    }

    @Test
    void allowsEnrollmentAfterIndividualAgreementIsCancelledWhileOldClassContinues() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Target class", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 2, "18:00", "19:30")));

        ClassRoom oldClass = createClassRoom(20L, "Old class", LocalDate.now(), LocalDate.now().plusMonths(2));
        oldClass.setSchedules(List.of(createSchedule(oldClass, 2, "18:00", "19:30")));
        EnrollmentRequest cancelledEnrollment = new EnrollmentRequest();
        cancelledEnrollment.setClassRoom(oldClass);
        cancelledEnrollment.setStudentId(100L);
        cancelledEnrollment.setStudentEmail("student@example.com");
        cancelledEnrollment.setStatus(EnrollmentRequestStatus.CANCELLED);
        cancelledEnrollment.setAgreementId("agreement-cancelled");

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.PENDING)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any())).thenReturn(false);
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com")).thenReturn(List.of(cancelledEnrollment));
        when(enrollmentRequestRepository.save(any())).thenAnswer(i -> {
            EnrollmentRequest r = i.getArgument(0);
            ReflectionTestUtils.setField(r, "id", 1L);
            return r;
        });

        assertThat(service.enrollClass(10L, 100L, "student@example.com", validRequest())).isNotNull();
    }

    @Test
    void allowsEnrollmentWhenSchedulesDoNotOverlapInTime() {
        EnrollmentRequestService service = service();

        // Target classroom: Mon (day 2) 18:00 - 19:30
        ClassRoom targetClass = createClassRoom(10L, "Toán Lớp 10 Nâng Cao", LocalDate.now(), LocalDate.now().plusMonths(2));
        ClassSchedule targetSlot = createSchedule(targetClass, 2, "18:00", "19:30");
        targetClass.setSchedules(List.of(targetSlot));

        // Existing accepted class: Mon (day 2) 19:30 - 21:00 (back-to-back, no overlap)
        ClassRoom existingClass = createClassRoom(20L, "Vật Lý 10 Cơ Bản", LocalDate.now(), LocalDate.now().plusMonths(2));
        ClassSchedule existingSlot = createSchedule(existingClass, 2, "19:30", "21:00");
        existingClass.setSchedules(List.of(existingSlot));

        EnrollmentRequest acceptedReq = new EnrollmentRequest();
        acceptedReq.setClassRoom(existingClass);
        acceptedReq.setStudentEmail("student@example.com");
        acceptedReq.setStatus(EnrollmentRequestStatus.ACCEPTED);

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.PENDING)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any())).thenReturn(false);
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com")).thenReturn(List.of(acceptedReq));
        when(enrollmentRequestRepository.save(any())).thenAnswer(i -> {
            EnrollmentRequest r = i.getArgument(0);
            ReflectionTestUtils.setField(r, "id", 1L);
            return r;
        });

        EnrollClassRequest request = validRequest();

        var result = service.enrollClass(10L, 100L, "student@example.com", request);
        assertThat(result).isNotNull();
        assertThat(result.classRoomId()).isEqualTo(10L);
        assertThat(result.studentDateOfBirth()).isEqualTo(LocalDate.of(2005, 1, 1));
        assertThat(result.studentAddress()).isEqualTo("TP. Hồ Chí Minh");
    }

    @Test
    void allowsEnrollmentWhenDaysOfWeekAreDifferent() {
        EnrollmentRequestService service = service();

        // Target classroom: Tue (day 3) 18:00 - 19:30
        ClassRoom targetClass = createClassRoom(10L, "Hóa Học 10", LocalDate.now(), LocalDate.now().plusMonths(2));
        ClassSchedule targetSlot = createSchedule(targetClass, 3, "18:00", "19:30");
        targetClass.setSchedules(List.of(targetSlot));

        // Existing enrolled class: Mon (day 2) 18:00 - 19:30
        ClassRoom existingClass = createClassRoom(20L, "Vật Lý 10 Cơ Bản", LocalDate.now(), LocalDate.now().plusMonths(2));
        ClassSchedule existingSlot = createSchedule(existingClass, 2, "18:00", "19:30");
        existingClass.setSchedules(List.of(existingSlot));

        EnrollmentRequest acceptedReq = new EnrollmentRequest();
        acceptedReq.setClassRoom(existingClass);
        acceptedReq.setStudentEmail("student@example.com");
        acceptedReq.setStatus(EnrollmentRequestStatus.ACCEPTED);

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.PENDING)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any())).thenReturn(false);
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com")).thenReturn(List.of(acceptedReq));
        when(enrollmentRequestRepository.save(any())).thenAnswer(i -> {
            EnrollmentRequest r = i.getArgument(0);
            ReflectionTestUtils.setField(r, "id", 1L);
            return r;
        });

        EnrollClassRequest request = validRequest();

        var result = service.enrollClass(10L, 100L, "student@example.com", request);
        assertThat(result).isNotNull();
    }

    @Test
    void getStudentScheduleReturnsSchedulesAndSessions() {
        EnrollmentRequestService service = service();

        ClassRoom enrolledClass = createClassRoom(20L, "Toán 12 Luyện Thi", LocalDate.now(), LocalDate.now().plusMonths(3));
        enrolledClass.setTutorFullName("Thầy Bình");
        enrolledClass.setMeetingLink("https://meet.google.com/xyz-abc");
        ClassSchedule schedule = createSchedule(enrolledClass, 2, "19:00", "20:30");
        enrolledClass.setSchedules(List.of(schedule));

        EnrollmentRequest acceptedReq = new EnrollmentRequest();
        acceptedReq.setClassRoom(enrolledClass);
        acceptedReq.setStudentEmail("student@example.com");
        acceptedReq.setStatus(EnrollmentRequestStatus.ENROLLED);

        ClassSession session = new ClassSession();
        ReflectionTestUtils.setField(session, "id", 101L);
        session.setClassRoom(enrolledClass);
        session.setSequenceNumber(1);
        session.setTopic("Hàm số lượng giác");
        session.setSessionDate(LocalDate.now().plusDays(2));
        session.setStartTime("19:00");
        session.setEndTime("20:30");
        session.setStatus(ClassSessionStatus.SCHEDULED);

        when(enrollmentRequestRepository.findByStudentEmailWithDetails("student@example.com")).thenReturn(List.of(acceptedReq));
        when(classSessionRepository.findByClassRoomIdInOrderBySessionDateAscStartTimeAsc(List.of(20L))).thenReturn(List.of(session));

        StudentScheduleResponse scheduleResponse = service.getStudentSchedule("student@example.com");

        assertThat(scheduleResponse.recurringSchedules()).hasSize(1);
        assertThat(scheduleResponse.recurringSchedules().get(0).className()).isEqualTo("Toán 12 Luyện Thi");
        assertThat(scheduleResponse.recurringSchedules().get(0).startTime()).isEqualTo("19:00");

        assertThat(scheduleResponse.sessions()).hasSize(1);
        assertThat(scheduleResponse.sessions().get(0).topic()).isEqualTo("Hàm số lượng giác");
    }

    @Test
    void studentScheduleIncludesAcceptedReservationBeforeEscrowFunding() {
        EnrollmentRequestService service = service();
        ClassRoom reservedClass = createClassRoom(20L, "Lớp đang giữ chỗ", LocalDate.now(), LocalDate.now().plusMonths(1));
        reservedClass.setSchedules(List.of(createSchedule(reservedClass, 3, "18:00", "19:30")));
        EnrollmentRequest request = new EnrollmentRequest();
        request.setClassRoom(reservedClass);
        request.setStudentEmail("student@example.com");
        request.setStatus(EnrollmentRequestStatus.ACCEPTED);
        when(enrollmentRequestRepository.findByStudentEmailWithDetails("student@example.com")).thenReturn(List.of(request));

        StudentScheduleResponse response = service.getStudentSchedule("student@example.com");

        assertThat(response.recurringSchedules()).hasSize(1);
        assertThat(response.recurringSchedules().getFirst().enrollmentStatus()).isEqualTo(EnrollmentRequestStatus.ACCEPTED);
        assertThat(response.sessions()).isEmpty();
    }

    @Test
    void cancelledClassKeepsCompletedSessionsVisibleAndOnlyMarksFutureSessionsStopped() {
        EnrollmentRequestService service = service();
        ClassRoom classRoom = createClassRoom(20L, "Lớp đã thanh lý", LocalDate.now().minusMonths(1), LocalDate.now().plusMonths(1));
        classRoom.setStatus(ClassRoomStatus.CANCELLED);
        classRoom.setTerminationCutoffSession(1);
        EnrollmentRequest enrollment = new EnrollmentRequest();
        enrollment.setClassRoom(classRoom);
        enrollment.setStudentEmail("student@example.com");
        enrollment.setStatus(EnrollmentRequestStatus.CANCELLED);
        enrollment.setAgreementId("agreement-terminated");

        ClassSession completed = new ClassSession();
        ReflectionTestUtils.setField(completed, "id", 101L);
        completed.setClassRoom(classRoom);
        completed.setSequenceNumber(1);
        completed.setSessionDate(LocalDate.now().minusDays(7));
        completed.setStartTime("19:00");
        completed.setEndTime("20:30");
        completed.setStatus(ClassSessionStatus.COMPLETED);

        ClassSession cancelled = new ClassSession();
        ReflectionTestUtils.setField(cancelled, "id", 102L);
        cancelled.setClassRoom(classRoom);
        cancelled.setSequenceNumber(2);
        cancelled.setSessionDate(LocalDate.now().plusDays(7));
        cancelled.setStartTime("19:00");
        cancelled.setEndTime("20:30");
        cancelled.setStatus(ClassSessionStatus.CANCELLED);

        when(enrollmentRequestRepository.findByStudentEmailWithDetails("student@example.com")).thenReturn(List.of(enrollment));
        when(classSessionRepository.findByClassRoomIdInOrderBySessionDateAscStartTimeAsc(List.of(20L)))
                .thenReturn(List.of(completed, cancelled));

        StudentScheduleResponse response = service.getStudentSchedule("student@example.com");

        assertThat(response.recurringSchedules()).isEmpty();
        assertThat(response.sessions()).hasSize(2);
        assertThat(response.sessions().get(0).status()).isEqualTo("COMPLETED");
        assertThat(response.sessions().get(0).attendanceStopped()).isFalse();
        assertThat(response.sessions().get(1).status()).isEqualTo("CANCELLED");
        assertThat(response.sessions().get(1).attendanceStopped()).isTrue();
    }

    @Test
    void individuallyCancelledEnrollmentHasNoRecurringScheduleButKeepsStoppedSessionHistory() {
        EnrollmentRequestService service = service();
        ClassRoom classRoom = createClassRoom(20L, "Class continuing for other students", LocalDate.now().minusMonths(1), LocalDate.now().plusMonths(1));
        classRoom.setSchedules(List.of(createSchedule(classRoom, 2, "19:00", "20:30")));
        EnrollmentRequest enrollment = new EnrollmentRequest();
        enrollment.setClassRoom(classRoom);
        enrollment.setStudentId(100L);
        enrollment.setStudentEmail("student@example.com");
        enrollment.setStatus(EnrollmentRequestStatus.CANCELLED);
        enrollment.setAgreementId("agreement-terminated");

        ClassSession future = new ClassSession();
        ReflectionTestUtils.setField(future, "id", 102L);
        future.setClassRoom(classRoom);
        future.setSequenceNumber(2);
        future.setSessionDate(LocalDate.now().plusDays(7));
        future.setStartTime("19:00");
        future.setEndTime("20:30");
        future.setStatus(ClassSessionStatus.SCHEDULED);

        LearningTerminationStop stop = new LearningTerminationStop();
        stop.setAgreementId("agreement-terminated");
        stop.setClassroomId(20L);
        stop.setStudentId(100L);
        stop.setCutoffSession(1);

        when(enrollmentRequestRepository.findByStudentEmailWithDetails("student@example.com")).thenReturn(List.of(enrollment));
        when(terminationStops.findByClassroomIdAndStudentId(20L, 100L)).thenReturn(List.of(stop));
        when(classSessionRepository.findByClassRoomIdInOrderBySessionDateAscStartTimeAsc(List.of(20L)))
                .thenReturn(List.of(future));

        StudentScheduleResponse response = service.getStudentSchedule("student@example.com");

        assertThat(response.recurringSchedules()).isEmpty();
        assertThat(response.sessions()).hasSize(1);
        assertThat(response.sessions().get(0).status()).isEqualTo("CANCELLED");
        assertThat(response.sessions().get(0).attendanceStopped()).isTrue();
    }

    @Test
    void tutorCannotAcceptRequestWhileAnEarlierPendingReservationConflicts() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Hóa học", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 7, "13:00", "14:30")));
        EnrollmentRequest target = new EnrollmentRequest();
        ReflectionTestUtils.setField(target, "id", 1L);
        target.setClassRoom(targetClass);
        target.setStudentId(100L);
        target.setStudentEmail("student@example.com");
        target.setStatus(EnrollmentRequestStatus.PENDING);

        ClassRoom pendingClass = createClassRoom(20L, "Toán học", LocalDate.now(), LocalDate.now().plusMonths(2));
        pendingClass.setSchedules(List.of(createSchedule(pendingClass, 7, "13:00", "14:30")));
        EnrollmentRequest pending = new EnrollmentRequest();
        ReflectionTestUtils.setField(pending, "id", 2L);
        pending.setClassRoom(pendingClass);
        pending.setStudentId(100L);
        pending.setStudentEmail("student@example.com");
        pending.setStatus(EnrollmentRequestStatus.PENDING);

        when(enrollmentRequestRepository.findClassRoomIdById(1L)).thenReturn(Optional.of(10L));
        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.findById(1L)).thenReturn(Optional.of(target));
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com"))
                .thenReturn(List.of(target, pending));

        assertThatThrownBy(() -> service.acceptRequest(1L, "tutor@example.com", 200L, null))
                .isInstanceOf(StudentScheduleConflictException.class)
                .hasMessageContaining("Toán học");
        assertThat(target.getStatus()).isEqualTo(EnrollmentRequestStatus.PENDING);
        verify(enrollmentRequestRepository, never()).save(target);
        verify(eventPublisher, never()).publishEnrollmentAccepted(any(), any(), any(), any(), any(), any());
    }

    @Test
    void escrowActivationIsBlockedByConflictingPendingReservation() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Hóa học", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 7, "13:00", "14:30")));
        EnrollmentRequest target = new EnrollmentRequest();
        ReflectionTestUtils.setField(target, "id", 1L);
        target.setClassRoom(targetClass);
        target.setStudentId(100L);
        target.setStudentEmail("student@example.com");
        target.setAgreementId("agreement-1");
        target.setStatus(EnrollmentRequestStatus.ACCEPTED);

        ClassRoom pendingClass = createClassRoom(20L, "Toán học", LocalDate.now(), LocalDate.now().plusMonths(2));
        pendingClass.setSchedules(List.of(createSchedule(pendingClass, 7, "13:00", "14:30")));
        EnrollmentRequest pending = new EnrollmentRequest();
        ReflectionTestUtils.setField(pending, "id", 2L);
        pending.setClassRoom(pendingClass);
        pending.setStudentId(100L);
        pending.setStudentEmail("student@example.com");
        pending.setStatus(EnrollmentRequestStatus.PENDING);

        when(enrollmentRequestRepository.findByAgreementId("agreement-1")).thenReturn(Optional.of(target));
        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com"))
                .thenReturn(List.of(target, pending));

        assertThatThrownBy(() -> service.activateEnrollment(10L, 100L, "agreement-1"))
                .isInstanceOf(StudentScheduleConflictException.class)
                .hasMessageContaining("Toán học");
        assertThat(target.getStatus()).isEqualTo(EnrollmentRequestStatus.ACCEPTED);
        verify(enrollmentRequestRepository, never()).save(target);
        verify(rollingSessionService, never()).createMissingAttendancesForEnrollment(target);
    }

    @Test
    void sundayLegacyValueOneConflictsWithCanonicalValueEight() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Hóa học", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 8, "13:00", "14:30")));
        EnrollmentRequest target = new EnrollmentRequest();
        ReflectionTestUtils.setField(target, "id", 1L);
        target.setClassRoom(targetClass);
        target.setStudentId(100L);
        target.setStudentEmail("student@example.com");
        target.setStatus(EnrollmentRequestStatus.PENDING);

        ClassRoom legacySundayClass = createClassRoom(20L, "Toán học", LocalDate.now(), LocalDate.now().plusMonths(2));
        legacySundayClass.setSchedules(List.of(createSchedule(legacySundayClass, 1, "13:00", "14:30")));
        EnrollmentRequest existing = new EnrollmentRequest();
        ReflectionTestUtils.setField(existing, "id", 2L);
        existing.setClassRoom(legacySundayClass);
        existing.setStudentId(100L);
        existing.setStudentEmail("student@example.com");
        existing.setStatus(EnrollmentRequestStatus.ACCEPTED);

        when(enrollmentRequestRepository.findClassRoomIdById(1L)).thenReturn(Optional.of(10L));
        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.findById(1L)).thenReturn(Optional.of(target));
        when(enrollmentRequestRepository.findByStudentIdentityWithDetails(100L, "student@example.com"))
                .thenReturn(List.of(target, existing));

        assertThatThrownBy(() -> service.acceptRequest(1L, "tutor@example.com", 200L, null))
                .isInstanceOf(StudentScheduleConflictException.class)
                .hasMessageContaining("Chủ nhật");
    }

    @Test
    void malformedScheduleFailsClosedInsteadOfSkippingConflictCheck() {
        EnrollmentRequestService service = service();
        ClassRoom targetClass = createClassRoom(10L, "Hóa học", LocalDate.now(), LocalDate.now().plusMonths(2));
        targetClass.setSchedules(List.of(createSchedule(targetClass, 7, "not-a-time", "14:30")));

        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(targetClass));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(any(), any(), any()))
                .thenReturn(false);
        when(enrollmentRequestRepository.existsActiveByClassRoomAndStudentIdentity(any(), any(), any(), any()))
                .thenReturn(false);

        assertThatThrownBy(() -> service.enrollClass(10L, 100L, "student@example.com", validRequest()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Dữ liệu lịch")
                .hasMessageContaining("không hợp lệ");
        verify(enrollmentRequestRepository, never()).save(any());
    }

    private EnrollmentRequestService service() {
        return new EnrollmentRequestService(
                classRoomRepository,
                enrollmentRequestRepository,
                classSessionRepository,
                tutorAuthorizationStateRepository,
                eventPublisher,
                rollingSessionService,
                terminationStops,
                studentScheduleGuard);
    }

    private EnrollClassRequest validRequest() {
        return new EnrollClassRequest(
                null, "note", "Nguyen Van An", "0900000000", WALLET,
                LocalDate.of(2005, 1, 1), "TP. Hồ Chí Minh");
    }

    private ClassRoom createClassRoom(Long id, String name, LocalDate startDate, LocalDate endDate) {
        ClassRoom classRoom = new ClassRoom();
        ReflectionTestUtils.setField(classRoom, "id", id);
        classRoom.setName(name);
        classRoom.setTutorEmail("tutor@example.com");
        classRoom.setTutorFullName("Gia sư Demo");
        classRoom.setStatus(ClassRoomStatus.PUBLISHED);
        classRoom.setJoinMode(JoinMode.OPEN_REQUEST);
        classRoom.setStartDate(startDate);
        classRoom.setEndDate(endDate);
        classRoom.setMaxStudents(10);
        classRoom.setMaxPendingRequests(15);
        return classRoom;
    }

    private ClassSchedule createSchedule(ClassRoom classRoom, Integer dayOfWeek, String startTime, String endTime) {
        ClassSchedule schedule = new ClassSchedule();
        schedule.setClassRoom(classRoom);
        schedule.setDayOfWeek(dayOfWeek);
        schedule.setStartTime(startTime);
        schedule.setEndTime(endTime);
        return schedule;
    }
}
