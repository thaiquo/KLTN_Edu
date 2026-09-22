package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.CatalogCategory;
import iuh.fit.learning_service.entity.CatalogLevel;
import iuh.fit.learning_service.entity.CatalogSubject;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.TutorAuthorizationState;
import iuh.fit.learning_service.entity.TutorAvailability;
import iuh.fit.learning_service.entity.TutorSubjectRegistration;
import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.DurationUnit;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.SyllabusMode;
import iuh.fit.learning_service.enums.TeachingMode;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.CatalogLevelRepository;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import iuh.fit.learning_service.repository.TutorAvailabilityRepository;
import iuh.fit.learning_service.repository.TutorSubjectRegistrationRepository;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClassRoomServiceTest {

    @Mock
    private ClassRoomRepository classRoomRepository;

    @Mock
    private TutorSubjectRegistrationRepository registrationRepository;

    @Mock
    private CatalogLevelRepository levelRepository;

    @Mock
    private TutorAvailabilityRepository availabilityRepository;

    @Mock
    private EnrollmentRequestRepository enrollmentRequestRepository;

    @Mock
    private TutorAuthorizationStateRepository tutorAuthorizationStateRepository;

    @Mock
    private TutorIdentityLookup tutorIdentityLookup;

    @Mock
    private LearningEventPublisher eventPublisher;

    @Mock
    private RealtimeEventHub realtimeEventHub;

    @InjectMocks
    private ClassRoomService service;

    @Test
    void tutorCanDeleteOwnPendingApprovalClass() {
        ClassRoom classRoom = classRoom("tutor@example.com", ClassRoomStatus.PENDING_APPROVAL);
        when(classRoomRepository.findById(10L)).thenReturn(Optional.of(classRoom));

        service.deleteClass("tutor@example.com", 10L);

        verify(classRoomRepository).delete(classRoom);
    }

    @Test
    void tutorCannotDeleteActiveClass() {
        ClassRoom classRoom = classRoom("tutor@example.com", ClassRoomStatus.ACTIVE);
        when(classRoomRepository.findById(10L)).thenReturn(Optional.of(classRoom));

        assertThrows(ConflictException.class,
                () -> service.deleteClass("tutor@example.com", 10L));

        verify(classRoomRepository, never()).delete(classRoom);
    }

    @Test
    void approveClassPublishesPersistentNotificationToTutorUserId() {
        ClassRoom classRoom = classRoom("tutor@example.com", ClassRoomStatus.PENDING_APPROVAL);
        classRoom.setId(77L);
        classRoom.setTutorProfileId(88L);
        classRoom.setName("Math 10");

        TutorAuthorizationState state = new TutorAuthorizationState();
        state.setUserId(99L);
        state.setTutorProfileId(88L);
        state.setStatus("APPROVED");

        when(classRoomRepository.findById(77L)).thenReturn(Optional.of(classRoom));
        when(classRoomRepository.save(classRoom)).thenReturn(classRoom);
        when(tutorAuthorizationStateRepository.findByTutorProfileId(88L)).thenReturn(Optional.of(state));

        service.approveClass(77L, "staff@example.com");

        verify(realtimeEventHub).publishToAll(eq("CLASS_REVIEWED"), eq(77L), any());
        verify(eventPublisher).publishClassReviewed(
                77L,
                99L,
                "tutor@example.com",
                "Math 10",
                "APPROVED",
                null,
                "staff@example.com");
    }

    @Test
    void rejectClassPublishesPersistentNotificationWithReason() {
        ClassRoom classRoom = classRoom("tutor@example.com", ClassRoomStatus.PENDING_APPROVAL);
        classRoom.setId(77L);
        classRoom.setTutorProfileId(88L);
        classRoom.setName("Math 10");

        TutorAuthorizationState state = new TutorAuthorizationState();
        state.setUserId(99L);
        state.setTutorProfileId(88L);
        state.setStatus("APPROVED");

        when(classRoomRepository.findById(77L)).thenReturn(Optional.of(classRoom));
        when(classRoomRepository.save(classRoom)).thenReturn(classRoom);
        when(tutorAuthorizationStateRepository.findByTutorProfileId(88L)).thenReturn(Optional.of(state));

        service.rejectClass(77L, "staff@example.com", "Need clearer syllabus");

        verify(realtimeEventHub).publishToAll(eq("CLASS_REVIEWED"), eq(77L), any());
        verify(eventPublisher).publishClassReviewed(
                77L,
                99L,
                "tutor@example.com",
                "Math 10",
                "REJECTED",
                "Need clearer syllabus",
                "staff@example.com");
    }

    @Test
    void publicClassResponseDoesNotExposeMeetingLink() {
        ClassRoom classRoom = classRoom("tutor@example.com", ClassRoomStatus.PUBLISHED);
        classRoom.setId(77L);
        classRoom.setName("Math 10");
        classRoom.setMeetingLink("https://meet.example/private-room");
        when(classRoomRepository.findByIdWithDetails(77L)).thenReturn(Optional.of(classRoom));

        var response = service.getPublicClassById(77L);

        assertThat(response.meetingLink()).isNull();
    }

    @Test
    void tutorClassResponseStillContainsMeetingLink() {
        ClassRoom classRoom = classRoom("tutor@example.com", ClassRoomStatus.PUBLISHED);
        classRoom.setId(77L);
        classRoom.setName("Math 10");
        classRoom.setMeetingLink("https://meet.example/private-room");
        when(classRoomRepository.findByIdWithDetails(77L)).thenReturn(Optional.of(classRoom));

        var response = service.getClassById("tutor@example.com", 77L);

        assertThat(response.meetingLink()).isEqualTo("https://meet.example/private-room");
    }

    @Test
    void tutorWithOnlineModeCanCreateOnlineClass() {
        arrangeCreateClass(TeachingMode.ONLINE, List.of());

        var response = service.createClass("tutor@example.com", createRequest(LearningMode.ONLINE, "18:00", "19:30", LocalDate.of(2026, 10, 1)));

        assertThat(response.learningMode()).isEqualTo(LearningMode.ONLINE);
    }

    @Test
    void approvedRegistrationWithoutProfileUsesApprovedTutorAuthorization() {
        TutorSubjectRegistration registration = registration();
        registration.setTutorProfileId(null);
        CatalogLevel level = registration.getLevels().get(0);
        TutorAuthorizationState state = new TutorAuthorizationState();
        state.setUserId(99L);
        state.setTutorProfileId(88L);
        state.setStatus("APPROVED");
        state.getTeachingModes().add(TeachingMode.ONLINE);

        when(registrationRepository.findById(10L)).thenReturn(Optional.of(registration));
        when(tutorIdentityLookup.tutorProfileId("tutor@example.com")).thenReturn(Optional.of(88L));
        when(tutorAuthorizationStateRepository.findByTutorProfileId(88L)).thenReturn(Optional.of(state));
        lenient().when(levelRepository.findById(20L)).thenReturn(Optional.of(level));
        lenient().when(availabilityRepository.findByTutorEmailIgnoreCaseOrderByDayOfWeekAscStartTimeAsc("tutor@example.com"))
                .thenReturn(List.of(new TutorAvailability("tutor@example.com", 5, "00:00", "23:59")));
        lenient().when(classRoomRepository.findByTutorEmailWithDetails("tutor@example.com")).thenReturn(List.of());
        lenient().when(classRoomRepository.save(any(ClassRoom.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createClass("tutor@example.com", createRequest(LearningMode.ONLINE, "18:00", "19:30", LocalDate.of(2026, 10, 1)));

        assertThat(response.tutorProfileId()).isEqualTo(88L);
        assertThat(registration.getTutorProfileId()).isEqualTo(88L);
    }

    @Test
    void tutorWithOnlineModeCannotCreateOfflineClass() {
        arrangeCreateClass(TeachingMode.ONLINE, List.of());

        assertThrows(BadRequestException.class,
                () -> service.createClass("tutor@example.com", createRequest(LearningMode.OFFLINE, "18:00", "19:30", LocalDate.of(2026, 10, 1))));
    }

    @Test
    void tutorWithOfflineModeCanCreateOfflineClass() {
        arrangeCreateClass(TeachingMode.OFFLINE, List.of());

        var response = service.createClass("tutor@example.com", createRequest(LearningMode.OFFLINE, "18:00", "19:30", LocalDate.of(2026, 10, 1)));

        assertThat(response.learningMode()).isEqualTo(LearningMode.OFFLINE);
    }

    @Test
    void tutorWithBothModesCanCreateOnlineAndOfflineClasses() {
        arrangeCreateClass(List.of(TeachingMode.ONLINE, TeachingMode.OFFLINE), List.of());

        var online = service.createClass("tutor@example.com", createRequest(LearningMode.ONLINE, "18:00", "19:30", LocalDate.of(2026, 10, 1)));
        var offline = service.createClass("tutor@example.com", createRequest(LearningMode.OFFLINE, "20:00", "21:30", LocalDate.of(2026, 10, 1)));

        assertThat(online.learningMode()).isEqualTo(LearningMode.ONLINE);
        assertThat(offline.learningMode()).isEqualTo(LearningMode.OFFLINE);
    }

    @Test
    void sameDayTimeWithoutDateRangeOverlapDoesNotConflict() {
        ClassRoom existing = existingClass(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), 5, "18:00", "20:00");
        arrangeCreateClass(List.of(TeachingMode.ONLINE), List.of(existing));

        var response = service.createClass("tutor@example.com", createRequest(LearningMode.ONLINE, "18:00", "20:00", LocalDate.of(2026, 12, 1)));

        assertThat(response.learningMode()).isEqualTo(LearningMode.ONLINE);
    }

    @Test
    void sameDayTimeWithDateRangeOverlapConflicts() {
        ClassRoom existing = existingClass(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), 5, "18:00", "20:00");
        arrangeCreateClass(List.of(TeachingMode.ONLINE), List.of(existing));

        assertThrows(BadRequestException.class,
                () -> service.createClass("tutor@example.com", createRequest(LearningMode.ONLINE, "19:00", "21:00", LocalDate.of(2026, 10, 15))));
    }

    @Test
    void overlappingDateRangeDifferentDayDoesNotConflict() {
        ClassRoom existing = existingClass(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), 4, "18:00", "20:00");
        arrangeCreateClass(List.of(TeachingMode.ONLINE), List.of(existing));

        var response = service.createClass("tutor@example.com", createRequest(LearningMode.ONLINE, "18:00", "20:00", LocalDate.of(2026, 10, 15)));

        assertThat(response.learningMode()).isEqualTo(LearningMode.ONLINE);
    }

    @Test
    void overlappingDateRangeSameDayNonOverlappingTimeDoesNotConflict() {
        ClassRoom existing = existingClass(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), 5, "18:00", "20:00");
        arrangeCreateClass(List.of(TeachingMode.ONLINE), List.of(existing));

        var response = service.createClass("tutor@example.com", createRequest(LearningMode.ONLINE, "20:00", "21:30", LocalDate.of(2026, 10, 15)));

        assertThat(response.learningMode()).isEqualTo(LearningMode.ONLINE);
    }

    private ClassRoom classRoom(String tutorEmail, ClassRoomStatus status) {
        ClassRoom classRoom = new ClassRoom();
        classRoom.setTutorEmail(tutorEmail);
        classRoom.setStatus(status);
        return classRoom;
    }

    private void arrangeCreateClass(TeachingMode mode, List<ClassRoom> existingClasses) {
        arrangeCreateClass(List.of(mode), existingClasses);
    }

    private void arrangeCreateClass(List<TeachingMode> modes, List<ClassRoom> existingClasses) {
        TutorSubjectRegistration registration = registration();
        CatalogLevel level = registration.getLevels().get(0);
        TutorAuthorizationState state = new TutorAuthorizationState();
        state.setUserId(99L);
        state.setTutorProfileId(88L);
        state.setStatus("APPROVED");
        state.getTeachingModes().addAll(modes);

        when(registrationRepository.findById(10L)).thenReturn(Optional.of(registration));
        lenient().when(levelRepository.findById(20L)).thenReturn(Optional.of(level));
        when(tutorAuthorizationStateRepository.findByTutorProfileId(88L)).thenReturn(Optional.of(state));
        lenient().when(availabilityRepository.findByTutorEmailIgnoreCaseOrderByDayOfWeekAscStartTimeAsc("tutor@example.com"))
                .thenReturn(List.of(new TutorAvailability("tutor@example.com", 5, "00:00", "23:59")));
        lenient().when(classRoomRepository.findByTutorEmailWithDetails("tutor@example.com")).thenReturn(existingClasses);
        lenient().when(classRoomRepository.save(any(ClassRoom.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private TutorSubjectRegistration registration() {
        CatalogCategory category = new CatalogCategory();
        category.setActive(true);

        CatalogSubject subject = new CatalogSubject();
        subject.setId(30L);
        subject.setName("Math");
        subject.setCode("MATH");
        subject.setCategory(category);
        subject.setActive(true);

        CatalogLevel level = new CatalogLevel();
        level.setId(20L);
        level.setName("Grade 10");
        level.setCode("GRADE_10");
        level.setSubject(subject);
        level.setActive(true);

        TutorSubjectRegistration registration = new TutorSubjectRegistration();
        registration.setId(10L);
        registration.setTutorEmail("tutor@example.com");
        registration.setTutorProfileId(88L);
        registration.setCategory(category);
        registration.setSubject(subject);
        registration.setStatus(TutorSubjectRegistrationStatus.APPROVED);
        registration.setTuitionMin(BigDecimal.valueOf(100_000));
        registration.setTuitionMax(BigDecimal.valueOf(300_000));
        registration.setLevels(new ArrayList<>(List.of(level)));
        return registration;
    }

    private ClassRoomDtos.CreateClassRoomRequest createRequest(LearningMode mode, String startTime, String endTime, LocalDate startDate) {
        return new ClassRoomDtos.CreateClassRoomRequest(
                10L,
                20L,
                88L,
                "Tutor Example",
                "Lớp kiểm thử",
                "Mô tả lớp kiểm thử",
                mode,
                mode == LearningMode.ONLINE ? "https://meet.example/test" : null,
                mode == LearningMode.OFFLINE ? "123 Đường Kiểm Thử" : null,
                10,
                null,
                150,
                BigDecimal.valueOf(150_000),
                1,
                (int) java.time.Duration.between(java.time.LocalTime.parse(startTime), java.time.LocalTime.parse(endTime)).toMinutes(),
                4,
                DurationUnit.WEEK,
                startDate,
                List.of(new ClassRoomDtos.ScheduleRequest(5, startTime, endTime)),
                SyllabusMode.FILE,
                "https://files.example/syllabus.pdf",
                List.of()
        );
    }

    private ClassRoom existingClass(LocalDate startDate, LocalDate endDate, int dayOfWeek, String startTime, String endTime) {
        ClassRoom classRoom = classRoom("tutor@example.com", ClassRoomStatus.ACTIVE);
        classRoom.setName("Existing class");
        classRoom.setStartDate(startDate);
        classRoom.setEndDate(endDate);
        ClassSchedule schedule = new ClassSchedule();
        schedule.setClassRoom(classRoom);
        schedule.setDayOfWeek(dayOfWeek);
        schedule.setStartTime(startTime);
        schedule.setEndTime(endTime);
        classRoom.setSchedules(List.of(schedule));
        return classRoom;
    }
}
