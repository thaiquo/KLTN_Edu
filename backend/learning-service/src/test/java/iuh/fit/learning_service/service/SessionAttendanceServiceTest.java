package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.ClassSessionDtos;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.SessionAttendance;
import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionAttendanceServiceTest {

    @Mock
    private ClassSessionRepository classSessionRepository;

    @Mock
    private SessionAttendanceRepository sessionAttendanceRepository;

    @Mock
    private ClassRoomRepository classRoomRepository;

    @Mock
    private RollingSessionService rollingSessionService;

    @Mock
    private SessionAccessControl sessionAccessControl;

    @Mock
    private ContractServiceDispatcher contractServiceDispatcher;

    @InjectMocks
    private SessionAttendanceService sessionAttendanceService;

    private ClassRoom classRoom;
    private ClassSession session;

    @BeforeEach
    void setUp() {
        classRoom = new ClassRoom();
        classRoom.setId(100L);
        classRoom.setName("Toán 12 Cơ bản");
        classRoom.setTutorProfileId(10L);
        classRoom.setTutorEmail("tutor@edu.vn");

        session = new ClassSession();
        session.setId(1L);
        session.setClassRoom(classRoom);
        session.setSequenceNumber(1);
        session.setTopic("Hàm số đơn điệu");
        session.setSessionDate(LocalDate.now().minusDays(1)); // hôm qua -> quá hạn
        session.setStartTime("08:00");
        session.setEndTime("10:00");
        session.setAssignmentTitle("Bài tập hàm số");
        session.setAssignmentDescription("Làm câu 1-10");
        session.setAssignmentFileUrl("https://storage/baitap1.pdf");
        session.setStatus(ClassSessionStatus.SCHEDULED);
        session.setCreatedAt(LocalDateTime.now().minusDays(2));
    }

    @Test
    @DisplayName("autoFinalizePastDueSessions resolves outcomes and dispatches auto settlement proposal")
    void testAutoFinalizePastDueSessions_DispatchesSettlement() {
        // Attendance 1: both present
        SessionAttendance att1 = new SessionAttendance();
        att1.setId(101L);
        att1.setSession(session);
        att1.setStudentId(201L);
        att1.setStudentName("Học viên A");
        att1.setStudentEmail("a@edu.vn");
        att1.setTutorId(10L);
        att1.setTutorChecked(true);
        att1.setStudentChecked(true);

        // Attendance 2: student absent
        SessionAttendance att2 = new SessionAttendance();
        att2.setId(102L);
        att2.setSession(session);
        att2.setStudentId(202L);
        att2.setStudentName("Học viên B");
        att2.setStudentEmail("b@edu.vn");
        att2.setTutorId(10L);
        att2.setTutorChecked(true);
        att2.setStudentChecked(false);

        when(classSessionRepository.findAll()).thenReturn(List.of(session));
        when(sessionAttendanceRepository.findBySessionId(1L)).thenReturn(List.of(att1, att2));
        when(sessionAttendanceRepository.save(any(SessionAttendance.class))).thenAnswer(inv -> inv.getArgument(0));
        when(classSessionRepository.save(any(ClassSession.class))).thenAnswer(inv -> inv.getArgument(0));

        sessionAttendanceService.autoFinalizePastDueSessions();

        // Verify session status updated to COMPLETED
        assertThat(session.getStatus()).isEqualTo(ClassSessionStatus.COMPLETED);

        // Verify outcomes
        assertThat(att1.getFinalOutcome()).isEqualTo(AttendanceOutcome.BOTH_PRESENT);
        assertThat(att2.getFinalOutcome()).isEqualTo(AttendanceOutcome.STUDENT_ABSENT_TUTOR_PRESENT);

        // Verify contractServiceDispatcher dispatched
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ContractServiceDispatcher.StudentAttendanceOutcomeItem>> captor =
                ArgumentCaptor.forClass(List.class);

        assertThat(session.isSettlementDispatched()).isFalse();
        verifyNoInteractions(contractServiceDispatcher);
    }

    @Test
    @DisplayName("getSessionById hides assignment content when student has not checked in")
    void testGetSessionById_GatedAssignmentAccess_HiddenWhenNotCheckedIn() {
        SessionAttendance att = new SessionAttendance();
        att.setId(101L);
        att.setSession(session);
        att.setStudentId(201L);
        att.setStudentName("Học viên A");
        att.setStudentEmail("a@edu.vn");
        att.setTutorId(10L);
        att.setStudentChecked(false);

        session.setAttendances(List.of(att));

        when(classSessionRepository.findById(1L)).thenReturn(Optional.of(session));
        when(sessionAccessControl.currentStudentId()).thenReturn(201L);

        ClassSessionDtos.ClassSessionResponse res = sessionAttendanceService.getSessionById(1L);

        assertThat(res.assignmentTitle()).isEqualTo("Bài tập hàm số");
        // Must be null because student has not checked in
        assertThat(res.assignmentDescription()).isNull();
        assertThat(res.assignmentFileUrl()).isNull();
        assertThat(res.myCheckedIn()).isFalse();
    }

    @Test
    @DisplayName("getSessionById reveals assignment content when student has checked in")
    void testGetSessionById_GatedAssignmentAccess_RevealedWhenCheckedIn() {
        SessionAttendance att = new SessionAttendance();
        att.setId(101L);
        att.setSession(session);
        att.setStudentId(201L);
        att.setStudentName("Học viên A");
        att.setStudentEmail("a@edu.vn");
        att.setTutorId(10L);
        att.setStudentChecked(true);

        session.setAttendances(List.of(att));

        when(classSessionRepository.findById(1L)).thenReturn(Optional.of(session));
        when(sessionAccessControl.currentStudentId()).thenReturn(201L);

        ClassSessionDtos.ClassSessionResponse res = sessionAttendanceService.getSessionById(1L);

        assertThat(res.assignmentTitle()).isEqualTo("Bài tập hàm số");
        // Must be revealed because student has checked in
        assertThat(res.assignmentDescription()).isEqualTo("Làm câu 1-10");
        assertThat(res.assignmentFileUrl()).isEqualTo("https://storage/baitap1.pdf");
        assertThat(res.myCheckedIn()).isTrue();
    }

    @Test
    @DisplayName("submitHomework rejects a student who did not check in")
    void submitHomeworkRejectsStudentWithoutValidCheckIn() {
        SessionAttendance attendance = new SessionAttendance();
        attendance.setSession(session);
        attendance.setStudentId(201L);
        attendance.setStudentChecked(false);
        when(classSessionRepository.findById(1L)).thenReturn(Optional.of(session));
        when(sessionAttendanceRepository.findBySessionIdAndStudentId(1L, 201L)).thenReturn(Optional.of(attendance));

        assertThatThrownBy(() -> sessionAttendanceService.submitHomework(
                1L, 201L, new ClassSessionDtos.SubmitHomeworkRequest("solution", null)))
                .isInstanceOf(ForbiddenException.class);
        verify(sessionAttendanceRepository, never()).save(any(SessionAttendance.class));
    }

    @Test
    @DisplayName("auto finalization refunds when tutor did not check in")
    void autoFinalizePastDueSessionsMarksTutorAbsent() {
        SessionAttendance attendance = new SessionAttendance();
        attendance.setSession(session);
        attendance.setStudentId(201L);
        attendance.setTutorChecked(false);
        attendance.setStudentChecked(true);
        when(classSessionRepository.findAll()).thenReturn(List.of(session));
        when(sessionAttendanceRepository.findBySessionId(1L)).thenReturn(List.of(attendance));
        when(sessionAttendanceRepository.save(any(SessionAttendance.class))).thenAnswer(inv -> inv.getArgument(0));
        when(classSessionRepository.save(any(ClassSession.class))).thenAnswer(inv -> inv.getArgument(0));

        sessionAttendanceService.autoFinalizePastDueSessions();

        assertThat(attendance.getFinalOutcome()).isEqualTo(AttendanceOutcome.TUTOR_ABSENT);
        assertThat(session.getStatus()).isEqualTo(ClassSessionStatus.COMPLETED);
    }
}
