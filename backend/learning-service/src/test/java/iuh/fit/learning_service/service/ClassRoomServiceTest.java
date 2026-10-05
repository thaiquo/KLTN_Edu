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
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
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
import iuh.fit.learning_service.repository.TutorReviewRepository;
import iuh.fit.learning_service.repository.TutorSubjectRegistrationRepository;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.lang.reflect.RecordComponent;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
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
    private TutorReviewRepository tutorReviewRepository;

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
    void publicSearchIncludesOnlyPublishedAndActiveClasses() {
        ClassRoom published = publicClass(1L, "Spring Toán 10", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-01T09:00:00");
        ClassRoom active = publicClass(2L, "Vật lý lớp 11", ClassRoomStatus.ACTIVE, 31L, 21L, LearningMode.OFFLINE, 180_000, "2026-10-02T09:00:00");
        ClassRoom closed = publicClass(3L, "Closed Math", ClassRoomStatus.CLOSED, 30L, 20L, LearningMode.ONLINE, 120_000, "2026-10-03T09:00:00");
        ClassRoom locked = publicClass(4L, "Locked Math", ClassRoomStatus.LOCKED, 30L, 20L, LearningMode.ONLINE, 120_000, "2026-10-04T09:00:00");
        when(classRoomRepository.findAllWithDetails()).thenReturn(List.of(published, active, closed, locked));

        var response = service.searchPublicClasses(null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, false, 0, 12, "newest");

        assertThat(response.totalElements()).isEqualTo(2);
        assertThat(response.content()).extracting(ClassRoomDtos.PublicClassCardResponse::id).containsExactly(2L, 1L);
    }

    @Test
    void publicSearchFiltersByKeywordSubjectLevelModeAndPrice() {
        ClassRoom target = publicClass(1L, "Spring Toán 10", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-01T09:00:00");
        target.setDescription("Ôn thi học kỳ theo lộ trình Spring");
        ClassRoom wrongLevel = publicClass(2L, "Spring Toán 11", ClassRoomStatus.PUBLISHED, 30L, 21L, LearningMode.ONLINE, 150_000, "2026-10-02T09:00:00");
        ClassRoom wrongMode = publicClass(3L, "Spring Toán 10 offline", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.OFFLINE, 150_000, "2026-10-03T09:00:00");
        ClassRoom tooExpensive = publicClass(4L, "Spring Toán 10 premium", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 350_000, "2026-10-04T09:00:00");
        when(classRoomRepository.findAllWithDetails()).thenReturn(List.of(target, wrongLevel, wrongMode, tooExpensive));

        var response = service.searchPublicClasses(null, null, null, 30L, 20L, null, "spring", "ONLINE", null, null,
                BigDecimal.valueOf(100_000), BigDecimal.valueOf(200_000), null, null, null, null, false, 0, 12, "newest");

        assertThat(response.totalElements()).isEqualTo(1);
        assertThat(response.content().get(0).id()).isEqualTo(1L);
    }

    @Test
    void publicSearchSupportsPaginationAndDeterministicPriceSort() {
        ClassRoom cheap = publicClass(1L, "Cheap", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 100_000, "2026-10-01T09:00:00");
        ClassRoom mid = publicClass(2L, "Mid", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-02T09:00:00");
        ClassRoom expensive = publicClass(3L, "Expensive", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 250_000, "2026-10-03T09:00:00");
        when(classRoomRepository.findAllWithDetails()).thenReturn(List.of(expensive, cheap, mid));

        var response = service.searchPublicClasses(null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, false, 1, 1, "price_asc");

        assertThat(response.totalElements()).isEqualTo(3);
        assertThat(response.totalPages()).isEqualTo(3);
        assertThat(response.page()).isEqualTo(1);
        assertThat(response.content()).extracting(ClassRoomDtos.PublicClassCardResponse::id).containsExactly(2L);
    }

    @Test
    void publicSearchFiltersByRecurringScheduleWindow() {
        ClassRoom evening = publicClass(1L, "Evening", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-01T09:00:00");
        evening.setSchedules(List.of(schedule(evening, 5, "18:00", "19:30")));
        ClassRoom morning = publicClass(2L, "Morning", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-02T09:00:00");
        morning.setSchedules(List.of(schedule(morning, 5, "08:00", "09:30")));
        when(classRoomRepository.findAllWithDetails()).thenReturn(List.of(evening, morning));

        var response = service.searchPublicClasses(null, null, null, null, null, null, null, null, null, null,
                null, null, 5, null, "17:00", "20:00", false, 0, 12, "newest");

        assertThat(response.content()).extracting(ClassRoomDtos.PublicClassCardResponse::id).containsExactly(1L);
    }

    @Test
    void publicSearchSupportsMultipleLevelIdsForDuplicateDisplayedLevels() {
        ClassRoom mathGrade10 = publicClass(1L, "Math grade 10", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-01T09:00:00");
        ClassRoom physicsGrade10 = publicClass(2L, "Physics grade 10", ClassRoomStatus.PUBLISHED, 31L, 22L, LearningMode.ONLINE, 150_000, "2026-10-02T09:00:00");
        ClassRoom grade11 = publicClass(3L, "Math grade 11", ClassRoomStatus.PUBLISHED, 30L, 21L, LearningMode.ONLINE, 150_000, "2026-10-03T09:00:00");
        when(classRoomRepository.findAllWithDetails()).thenReturn(List.of(mathGrade10, physicsGrade10, grade11));

        var response = service.searchPublicClasses(null, null, null, null, null, List.of(20L, 22L), null, null, null, null,
                null, null, null, null, null, null, false, 0, 12, "newest");

        assertThat(response.content()).extracting(ClassRoomDtos.PublicClassCardResponse::id).containsExactly(2L, 1L);
    }

    @Test
    void publicSearchTreatsSelectedWeekdaysAsStudentAvailabilitySubset() {
        ClassRoom fitsAvailability = publicClass(1L, "Fits availability", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-01T09:00:00");
        fitsAvailability.setSchedules(List.of(
                schedule(fitsAvailability, 2, "18:30", "20:00"),
                schedule(fitsAvailability, 4, "19:00", "20:30")
        ));
        ClassRoom outsideDay = publicClass(2L, "Outside day", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-02T09:00:00");
        outsideDay.setSchedules(List.of(
                schedule(outsideDay, 2, "18:30", "20:00"),
                schedule(outsideDay, 5, "19:00", "20:30")
        ));
        ClassRoom outsideTime = publicClass(3L, "Outside time", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-03T09:00:00");
        outsideTime.setSchedules(List.of(schedule(outsideTime, 2, "17:00", "18:30")));
        when(classRoomRepository.findAllWithDetails()).thenReturn(List.of(fitsAvailability, outsideDay, outsideTime));

        var response = service.searchPublicClasses(null, null, null, null, null, null, null, null, null, null,
                null, null, null, List.of(2, 4, 6), "18:00", "21:00", false, 0, 12, "newest");

        assertThat(response.content()).extracting(ClassRoomDtos.PublicClassCardResponse::id).containsExactly(1L);
    }

    @Test
    void publicSearchWithoutWeekdaysDoesNotRestrictClassDays() {
        ClassRoom monday = publicClass(1L, "Monday", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-01T09:00:00");
        monday.setSchedules(List.of(schedule(monday, 2, "18:00", "19:30")));
        ClassRoom saturday = publicClass(2L, "Saturday", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-02T09:00:00");
        saturday.setSchedules(List.of(schedule(saturday, 7, "18:00", "19:30")));
        when(classRoomRepository.findAllWithDetails()).thenReturn(List.of(monday, saturday));

        var response = service.searchPublicClasses(null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, false, 0, 12, "newest");

        assertThat(response.content()).extracting(ClassRoomDtos.PublicClassCardResponse::id).containsExactly(2L, 1L);
    }

    @Test
    void publicSearchHandlesInvalidFiltersSafely() {
        var invalidMode = service.searchPublicClasses(null, null, null, null, null, null, null, "HYBRID", null, null,
                null, null, null, null, null, null, false, 0, 12, "not_supported");
        var invalidTime = service.searchPublicClasses(null, null, null, null, null, null, null, null, null, null,
                null, null, 5, null, "20:00", "18:00", false, 0, 12, "newest");

        assertThat(invalidMode.content()).isEmpty();
        assertThat(invalidMode.sort()).isEqualTo("newest");
        assertThat(invalidTime.content()).isEmpty();
    }

    @Test
    void publicClassCardDoesNotExposePrivateFields() {
        ClassRoom classRoom = publicClass(1L, "Math", ClassRoomStatus.PUBLISHED, 30L, 20L, LearningMode.ONLINE, 150_000, "2026-10-01T09:00:00");
        classRoom.setMeetingLink("https://meet.example/private");
        classRoom.setJoinKey("SECRET");
        when(classRoomRepository.findAllWithDetails()).thenReturn(List.of(classRoom));

        var card = service.searchPublicClasses(null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, false, 0, 12, "newest").content().get(0);

        assertThat(Arrays.stream(card.getClass().getRecordComponents()).map(RecordComponent::getName))
                .doesNotContain("meetingLink", "joinKey", "tutorEmail", "rejectReason", "reviewedByEmail", "reviewedAt");
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

    private ClassRoom publicClass(Long id, String name, ClassRoomStatus status, Long subjectId, Long levelId,
                                  LearningMode mode, long price, String createdAt) {
        ClassRoom classRoom = classRoom("tutor@example.com", status);
        classRoom.setId(id);
        classRoom.setName(name);
        classRoom.setDescription("Mô tả lớp học");
        classRoom.setTutorFullName("Nguyễn Gia Sư");
        classRoom.setLearningMode(mode);
        classRoom.setMaxStudents(10);
        classRoom.setMaxPendingRequests(15);
        classRoom.setPricePerSession(BigDecimal.valueOf(price));
        classRoom.setTotalPrice(BigDecimal.valueOf(price * 8));
        classRoom.setSessionsPerWeek(2);
        classRoom.setDurationPerSessionMinutes(90);
        classRoom.setDurationValue(4);
        classRoom.setDurationUnit(DurationUnit.WEEK);
        classRoom.setStartDate(LocalDate.of(2026, 10, 1));
        classRoom.setEndDate(LocalDate.of(2026, 10, 29));
        classRoom.setTotalSessions(8);
        classRoom.setCreatedAt(LocalDateTime.parse(createdAt));
        classRoom.setTutorSubjectRegistration(publicRegistration(subjectId));
        classRoom.setLevel(publicLevel(levelId, classRoom.getTutorSubjectRegistration().getSubject()));
        classRoom.setSchedules(List.of(schedule(classRoom, 5, "18:00", "19:30")));
        lenient().when(enrollmentRequestRepository.countByClassRoomIdAndStatus(id, EnrollmentRequestStatus.PENDING)).thenReturn(0L);
        lenient().when(enrollmentRequestRepository.countByClassRoomIdAndStatusIn(eq(id), any())).thenReturn(0L);
        return classRoom;
    }

    private TutorSubjectRegistration publicRegistration(Long subjectId) {
        CatalogCategory category = new CatalogCategory();
        category.setId(100L);
        category.setName("Khoa học tự nhiên");
        category.setActive(true);

        CatalogSubject subject = new CatalogSubject();
        subject.setId(subjectId);
        subject.setName(subjectId == 31L ? "Vật lý" : "Toán");
        subject.setCode(subjectId == 31L ? "PHYSICS" : "MATH");
        subject.setCategory(category);
        subject.setActive(true);

        TutorSubjectRegistration registration = new TutorSubjectRegistration();
        registration.setId(500L + subjectId);
        registration.setTutorEmail("tutor@example.com");
        registration.setCategory(category);
        registration.setSubject(subject);
        registration.setStatus(TutorSubjectRegistrationStatus.APPROVED);
        registration.setTuitionMin(BigDecimal.valueOf(100_000));
        registration.setTuitionMax(BigDecimal.valueOf(300_000));
        return registration;
    }

    private CatalogLevel publicLevel(Long levelId, CatalogSubject subject) {
        CatalogLevel level = new CatalogLevel();
        level.setId(levelId);
        level.setName(levelId == 21L ? "Lớp 11" : "Lớp 10");
        level.setCode(levelId == 21L ? "GRADE_11" : "GRADE_10");
        level.setSubject(subject);
        level.setActive(true);
        return level;
    }

    private ClassSchedule schedule(ClassRoom classRoom, int dayOfWeek, String startTime, String endTime) {
        ClassSchedule schedule = new ClassSchedule();
        schedule.setClassRoom(classRoom);
        schedule.setDayOfWeek(dayOfWeek);
        schedule.setStartTime(startTime);
        schedule.setEndTime(endTime);
        return schedule;
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
