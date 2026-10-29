package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.EnrollClassRequest;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.any;

class EnrollmentRequestServiceIdentityTest {

    private static final String WALLET = "0x0000000000000000000000000000000000000001";

    private final ClassRoomRepository classRoomRepository = mock(ClassRoomRepository.class);

    private final EnrollmentRequestRepository enrollmentRequestRepository = mock(EnrollmentRequestRepository.class);

    private final iuh.fit.learning_service.repository.ClassSessionRepository classSessionRepository = mock(
            iuh.fit.learning_service.repository.ClassSessionRepository.class);

    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository = mock(
            TutorAuthorizationStateRepository.class);

    private final LearningEventPublisher eventPublisher = mock(LearningEventPublisher.class);

    private final RollingSessionService rollingSessionService = mock(RollingSessionService.class);

    private final EnrollmentRequestService service = new EnrollmentRequestService(
            classRoomRepository,
            enrollmentRequestRepository,
            classSessionRepository,
            tutorAuthorizationStateRepository,
            eventPublisher,
            rollingSessionService,
                mock(iuh.fit.learning_service.repository.LearningTerminationStopRepository.class));

    @Test
    void rejectsEnrollmentWhenJwtDoesNotContainStudentId() {
        EnrollClassRequest request = new EnrollClassRequest(
                null,
                null,
                "Nguyen Van An",
                "0900000000",
                WALLET,
                java.time.LocalDate.of(2005, 1, 1),
                "TP. Hồ Chí Minh");

        assertThatThrownBy(() -> service.enrollClass(
                1L,
                null,
                "student@example.com",
                request)).isInstanceOf(BadRequestException.class);

        verifyNoInteractions(
                classRoomRepository,
                enrollmentRequestRepository);
    }

    @Test
    void rejectsEnrollmentWithoutRealStudentName() {
        EnrollClassRequest request = new EnrollClassRequest(
                null,
                null,
                "student@example.com",
                "0900000000",
                WALLET,
                java.time.LocalDate.of(2005, 1, 1),
                "TP. Hồ Chí Minh");

        assertThatThrownBy(() -> service.enrollClass(
                1L,
                10L,
                "student@example.com",
                request)).isInstanceOf(BadRequestException.class);

        verifyNoInteractions(
                classRoomRepository,
                enrollmentRequestRepository);
    }

    @Test
    void rejectsEnrollmentWithoutStudentPhone() {
        EnrollClassRequest request = new EnrollClassRequest(
                null,
                null,
                "Nguyen Van An",
                " ",
                WALLET,
                java.time.LocalDate.of(2005, 1, 1),
                "TP. Hồ Chí Minh");

        assertThatThrownBy(() -> service.enrollClass(
                1L,
                10L,
                "student@example.com",
                request)).isInstanceOf(BadRequestException.class);

        verifyNoInteractions(
                classRoomRepository,
                enrollmentRequestRepository);
    }

    @Test
    void refusesActivationWhenAgreementIdentityDoesNotMatchEnrollment() {
        EnrollmentRequest enrollment = new EnrollmentRequest();
        ClassRoom classRoom = new ClassRoom();
        org.springframework.test.util.ReflectionTestUtils.setField(classRoom, "id", 22L);
        enrollment.setClassRoom(classRoom);
        enrollment.setStudentId(33L);
        enrollment.setAgreementId("agreement-a");
        enrollment.setStatus(EnrollmentRequestStatus.ACCEPTED);
        when(enrollmentRequestRepository.findByAgreementId("agreement-a"))
                .thenReturn(java.util.Optional.of(enrollment));

        assertThatThrownBy(() -> service.activateEnrollment(22L, 34L, "agreement-a"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("identity");
    }

    @Test
    void refusesActivationOfPendingRequestEvenWhenTheIdentityMatches() {
        EnrollmentRequest enrollment = new EnrollmentRequest();
        ClassRoom classRoom = new ClassRoom();
        org.springframework.test.util.ReflectionTestUtils.setField(classRoom, "id", 22L);
        enrollment.setClassRoom(classRoom);
        enrollment.setStudentId(33L);
        enrollment.setAgreementId("agreement-a");
        enrollment.setStatus(EnrollmentRequestStatus.PENDING);
        when(enrollmentRequestRepository.findByAgreementId("agreement-a"))
                .thenReturn(java.util.Optional.of(enrollment));

        assertThatThrownBy(() -> service.activateEnrollment(22L, 33L, "agreement-a"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cannot be activated");
    }

    @Test
    void refusesActivationWhenClassroomIsCancelled() {
        EnrollmentRequest enrollment = new EnrollmentRequest();
        ClassRoom classRoom = new ClassRoom();
        org.springframework.test.util.ReflectionTestUtils.setField(classRoom, "id", 22L);
        classRoom.setStatus(ClassRoomStatus.CANCELLED);
        enrollment.setClassRoom(classRoom);
        enrollment.setStudentId(33L);
        enrollment.setAgreementId("agreement-a");
        enrollment.setStatus(EnrollmentRequestStatus.ACCEPTED);
        when(enrollmentRequestRepository.findByAgreementId("agreement-a"))
                .thenReturn(java.util.Optional.of(enrollment));
        when(classRoomRepository.findByIdForUpdate(22L))
                .thenReturn(java.util.Optional.of(classRoom));

        assertThatThrownBy(() -> service.activateEnrollment(22L, 33L, "agreement-a"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cancelled or closed");
    }

    @Test
    void refusesActivationWhenClassroomIsClosed() {
        EnrollmentRequest enrollment = new EnrollmentRequest();
        ClassRoom classRoom = new ClassRoom();
        org.springframework.test.util.ReflectionTestUtils.setField(classRoom, "id", 22L);
        classRoom.setStatus(ClassRoomStatus.CLOSED);
        enrollment.setClassRoom(classRoom);
        enrollment.setStudentId(33L);
        enrollment.setAgreementId("agreement-a");
        enrollment.setStatus(EnrollmentRequestStatus.ACCEPTED);
        when(enrollmentRequestRepository.findByAgreementId("agreement-a"))
                .thenReturn(java.util.Optional.of(enrollment));
        when(classRoomRepository.findByIdForUpdate(22L))
                .thenReturn(java.util.Optional.of(classRoom));

        assertThatThrownBy(() -> service.activateEnrollment(22L, 33L, "agreement-a"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cancelled or closed");
    }

    @Test
    void refusesActivationWhenClassroomIsTerminating() {
        EnrollmentRequest enrollment = new EnrollmentRequest();
        ClassRoom classRoom = new ClassRoom();
        org.springframework.test.util.ReflectionTestUtils.setField(classRoom, "id", 22L);
        classRoom.setStatus(ClassRoomStatus.LOCKED);
        classRoom.setTerminationCutoffSession(3);
        enrollment.setClassRoom(classRoom);
        enrollment.setStudentId(33L);
        enrollment.setAgreementId("agreement-a");
        enrollment.setStatus(EnrollmentRequestStatus.ACCEPTED);
        when(enrollmentRequestRepository.findByAgreementId("agreement-a"))
                .thenReturn(java.util.Optional.of(enrollment));
        when(classRoomRepository.findByIdForUpdate(22L))
                .thenReturn(java.util.Optional.of(classRoom));

        assertThatThrownBy(() -> service.activateEnrollment(22L, 33L, "agreement-a"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Classroom is terminating");
    }

    @Test
    void activatesEnrollmentWhenClassroomIsActive() {
        EnrollmentRequest enrollment = new EnrollmentRequest();
        ClassRoom classRoom = new ClassRoom();
        org.springframework.test.util.ReflectionTestUtils.setField(classRoom, "id", 22L);
        classRoom.setStatus(ClassRoomStatus.LOCKED);
        enrollment.setClassRoom(classRoom);
        enrollment.setStudentId(33L);
        enrollment.setAgreementId("agreement-a");
        enrollment.setStatus(EnrollmentRequestStatus.ACCEPTED);
        when(enrollmentRequestRepository.findByAgreementId("agreement-a"))
                .thenReturn(java.util.Optional.of(enrollment));
        when(classRoomRepository.findByIdForUpdate(22L))
                .thenReturn(java.util.Optional.of(classRoom));
        when(enrollmentRequestRepository.save(any(EnrollmentRequest.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var response = service.activateEnrollment(22L, 33L, "agreement-a");
        assertThat(response).isNotNull();
        assertThat(enrollment.getStatus()).isEqualTo(EnrollmentRequestStatus.ENROLLED);
        verify(rollingSessionService).createMissingAttendancesForEnrollment(enrollment);
    }
}
