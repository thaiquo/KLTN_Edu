package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.LearningCopilotDtos.LessonContextResponse;
import iuh.fit.learning_service.dto.LearningCopilotDtos.HomeworkFeedbackContextResponse;
import iuh.fit.learning_service.entity.CatalogLevel;
import iuh.fit.learning_service.entity.CatalogSubject;
import iuh.fit.learning_service.entity.ClassChapter;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.SessionAttendance;
import iuh.fit.learning_service.entity.TutorSubjectRegistration;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearningCopilotContextServiceTest {
    @Mock
    private ClassRoomRepository classRoomRepository;
    @Mock
    private ClassSessionRepository classSessionRepository;
    @Mock
    private SessionAttendanceRepository sessionAttendanceRepository;
    @Mock
    private SessionAccessControl sessionAccessControl;

    private LearningCopilotContextService service;
    private ClassRoom classRoom;
    private ClassSession firstSession;
    private ClassSession secondSession;
    private ClassSession currentSession;

    @BeforeEach
    void setUp() {
        service = new LearningCopilotContextService(
                classRoomRepository,
                classSessionRepository,
                sessionAttendanceRepository,
                sessionAccessControl
        );

        CatalogSubject subject = new CatalogSubject();
        subject.setName("Toán");
        CatalogLevel level = new CatalogLevel();
        level.setName("Lớp 12");
        level.setSubject(subject);
        TutorSubjectRegistration registration = new TutorSubjectRegistration();
        registration.setSubject(subject);

        classRoom = new ClassRoom();
        classRoom.setId(42L);
        classRoom.setName("Toán 12 hình học không gian");
        classRoom.setDescription("Luyện dựng hình, vector và khoảng cách.");
        classRoom.setTutorEmail("tutor1@gmail.com");
        classRoom.setLearningMode(LearningMode.ONLINE);
        classRoom.setDurationPerSessionMinutes(90);
        classRoom.setSessionsPerWeek(2);
        classRoom.setTutorSubjectRegistration(registration);
        classRoom.setLevel(level);

        ClassSchedule schedule = new ClassSchedule();
        schedule.setDayOfWeek(2);
        schedule.setStartTime("18:30");
        schedule.setEndTime("20:00");
        schedule.setClassRoom(classRoom);
        classRoom.setSchedules(List.of(schedule));

        ClassChapter chapter = new ClassChapter();
        chapter.setTitle("Khoảng cách và góc trong không gian");
        chapter.setDescription("Luyện khoảng cách điểm, đường, mặt.");
        chapter.setExpectedSessions(6);
        chapter.setOrderIndex(2);
        chapter.setClassRoom(classRoom);
        classRoom.setChapters(List.of(chapter));

        firstSession = session(1L, 1, "Dựng hình và quan hệ vuông góc", ClassSessionStatus.COMPLETED);
        secondSession = session(2L, 2, "Vector trong không gian", ClassSessionStatus.COMPLETED);
        currentSession = session(3L, 3, "Khoảng cách từ điểm đến mặt phẳng", ClassSessionStatus.SCHEDULED);
    }

    @Test
    void owningTutorCanReadContextWithOrderedHistoryAndCatalogFields() {
        when(classRoomRepository.findByIdWithDetails(42L)).thenReturn(Optional.of(classRoom));
        when(classSessionRepository.findById(3L)).thenReturn(Optional.of(currentSession));
        when(classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(42L))
                .thenReturn(List.of(firstSession, secondSession, currentSession));
        when(sessionAttendanceRepository.findBySessionId(3L)).thenReturn(List.of());

        LessonContextResponse response = service.lessonContext(42L, 3L);

        verify(sessionAccessControl).requireTutor(classRoom);
        assertThat(response.classId()).isEqualTo(42L);
        assertThat(response.sessionId()).isEqualTo(3L);
        assertThat(response.subject()).isEqualTo("Toán");
        assertThat(response.level()).isEqualTo("Lớp 12");
        assertThat(response.learningMode()).isEqualTo("ONLINE");
        assertThat(response.chapters()).singleElement()
                .satisfies(chapter -> assertThat(chapter.title()).isEqualTo("Khoảng cách và góc trong không gian"));
        assertThat(response.previousSessions())
                .extracting("sequenceNumber")
                .containsExactly(1, 2);
        assertThat(response.currentSession().topic()).isEqualTo("Khoảng cách từ điểm đến mặt phẳng");
    }

    @Test
    void nonOwningTutorIsDeniedByExistingAuthorization() {
        when(classRoomRepository.findByIdWithDetails(42L)).thenReturn(Optional.of(classRoom));
        doThrow(new ForbiddenException("Only this classroom's tutor can manage sessions"))
                .when(sessionAccessControl).requireTutor(classRoom);

        assertThatThrownBy(() -> service.lessonContext(42L, 3L))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void studentActiveRoleIsDeniedByExistingTutorRequirement() {
        when(classRoomRepository.findByIdWithDetails(42L)).thenReturn(Optional.of(classRoom));
        doThrow(new ForbiddenException("Tutor role is required"))
                .when(sessionAccessControl).requireTutor(classRoom);

        assertThatThrownBy(() -> service.lessonContext(42L, 3L))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void classSessionMismatchIsRejected() {
        ClassRoom otherClass = new ClassRoom();
        otherClass.setId(99L);
        ClassSession mismatched = session(3L, 3, "Sai lớp", ClassSessionStatus.SCHEDULED);
        mismatched.setClassRoom(otherClass);

        when(classRoomRepository.findByIdWithDetails(42L)).thenReturn(Optional.of(classRoom));
        when(classSessionRepository.findById(3L)).thenReturn(Optional.of(mismatched));

        assertThatThrownBy(() -> service.lessonContext(42L, 3L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Session does not belong");
    }

    @Test
    void owningTutorCanReadHomeworkFeedbackMetadataWithoutSubmissionFileData() {
        SessionAttendance attendance = new SessionAttendance();
        attendance.setId(99L);
        attendance.setSession(currentSession);
        attendance.setSubmissionFileUrl("https://storage.example/submission.pdf");

        currentSession.setAssignmentTitle("Bài luyện tập hàm số");
        currentSession.setAssignmentDescription("Hoàn thành các bài vận dụng.");
        when(classRoomRepository.findByIdWithDetails(42L)).thenReturn(Optional.of(classRoom));
        when(classSessionRepository.findById(3L)).thenReturn(Optional.of(currentSession));
        when(sessionAttendanceRepository.findById(99L)).thenReturn(Optional.of(attendance));

        HomeworkFeedbackContextResponse response = service.homeworkFeedbackContext(42L, 3L, 99L);

        verify(sessionAccessControl).requireTutor(classRoom);
        assertThat(response.homeworkTitle()).isEqualTo("Bài luyện tập hàm số");
        assertThat(response.subject()).isEqualTo("Toán");
        assertThat(response.level()).isEqualTo("Lớp 12");
        assertThat(java.util.Arrays.stream(HomeworkFeedbackContextResponse.class.getRecordComponents())
                .map(component -> component.getName()))
                .doesNotContain("submissionFileUrl", "submissionText", "fileName", "studentName");
    }

    @Test
    void homeworkFeedbackContextRejectsAttendanceFromAnotherSession() {
        ClassSession otherSession = session(8L, 8, "Buổi khác", ClassSessionStatus.SCHEDULED);
        SessionAttendance attendance = new SessionAttendance();
        attendance.setId(99L);
        attendance.setSession(otherSession);
        attendance.setSubmittedAt(java.time.LocalDateTime.now());

        when(classRoomRepository.findByIdWithDetails(42L)).thenReturn(Optional.of(classRoom));
        when(classSessionRepository.findById(3L)).thenReturn(Optional.of(currentSession));
        when(sessionAttendanceRepository.findById(99L)).thenReturn(Optional.of(attendance));

        assertThatThrownBy(() -> service.homeworkFeedbackContext(42L, 3L, 99L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Submission does not belong");
    }

    private ClassSession session(Long id, Integer sequence, String topic, ClassSessionStatus status) {
        ClassSession session = new ClassSession();
        session.setId(id);
        session.setClassRoom(classRoom);
        session.setSequenceNumber(sequence);
        session.setTopic(topic);
        session.setSessionDate(LocalDate.of(2026, 10, 14).plusDays(sequence - 3L));
        session.setStartTime("18:30");
        session.setEndTime("20:00");
        session.setAssignmentTitle(sequence < 3 ? "Bài luyện tập " + sequence : null);
        session.setAssignmentDescription(sequence < 3 ? "Hoàn thành bài vận dụng sau buổi " + sequence : null);
        session.setStatus(status);
        return session;
    }
}
