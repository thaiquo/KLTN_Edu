package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.EnrollClassRequest;
import iuh.fit.learning_service.dto.EnrollmentRequestDtos.StudentScheduleResponse;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
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
        when(enrollmentRequestRepository.findByStudentEmailWithDetails("student@example.com")).thenReturn(List.of(acceptedReq));

        EnrollClassRequest request = new EnrollClassRequest(null, "note", "Nguyen Van An", "0900000000", WALLET);

        assertThatThrownBy(() -> service.enrollClass(10L, 100L, "student@example.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Trùng lịch học")
                .hasMessageContaining("Vật Lý 10 Cơ Bản");
    }

    @Test
    void allowsEnrollmentWhenSchedulesDoNotOverlapInTime() {
        EnrollmentRequestService service = service();

        // Target classroom: Mon (day 2) 18:00 - 19:30
        ClassRoom targetClass = createClassRoom(10L, "Toán Lớp 10 Nâng Cao", LocalDate.now(), LocalDate.now().plusMonths(2));
        ClassSchedule targetSlot = createSchedule(targetClass, 2, "18:00", "19:30");
        targetClass.setSchedules(List.of(targetSlot));

        // Existing enrolled class: Mon (day 2) 19:30 - 21:00 (back-to-back, no overlap)
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
        when(enrollmentRequestRepository.findByStudentEmailWithDetails("student@example.com")).thenReturn(List.of(acceptedReq));
        when(enrollmentRequestRepository.save(any())).thenAnswer(i -> {
            EnrollmentRequest r = i.getArgument(0);
            ReflectionTestUtils.setField(r, "id", 1L);
            return r;
        });

        EnrollClassRequest request = new EnrollClassRequest(null, "note", "Nguyen Van An", "0900000000", WALLET);

        var result = service.enrollClass(10L, 100L, "student@example.com", request);
        assertThat(result).isNotNull();
        assertThat(result.classRoomId()).isEqualTo(10L);
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
        when(enrollmentRequestRepository.findByStudentEmailWithDetails("student@example.com")).thenReturn(List.of(acceptedReq));
        when(enrollmentRequestRepository.save(any())).thenAnswer(i -> {
            EnrollmentRequest r = i.getArgument(0);
            ReflectionTestUtils.setField(r, "id", 1L);
            return r;
        });

        EnrollClassRequest request = new EnrollClassRequest(null, "note", "Nguyen Van An", "0900000000", WALLET);

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
        acceptedReq.setStatus(EnrollmentRequestStatus.ACCEPTED);

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

    private EnrollmentRequestService service() {
        return new EnrollmentRequestService(
                classRoomRepository,
                enrollmentRequestRepository,
                classSessionRepository,
                tutorAuthorizationStateRepository,
                eventPublisher);
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
