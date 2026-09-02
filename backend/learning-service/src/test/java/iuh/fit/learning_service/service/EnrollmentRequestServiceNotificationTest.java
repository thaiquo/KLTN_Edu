package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.EnrollClassRequest;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.entity.TutorAuthorizationState;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentRequestServiceNotificationTest {
    @Mock
    private ClassRoomRepository classRoomRepository;
    @Mock
    private EnrollmentRequestRepository enrollmentRequestRepository;
    @Mock
    private TutorAuthorizationStateRepository tutorAuthorizationStateRepository;
    @Mock
    private LearningEventPublisher eventPublisher;

    @Test
    void enrollClassPublishesEnrollmentRequestedToTutor() {
        EnrollmentRequestService service = service();
        ClassRoom classRoom = classRoom();
        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(classRoom));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(
                ArgumentMatchers.eq(10L),
                ArgumentMatchers.eq("student@example.com"),
                any()
        )).thenReturn(false);
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.PENDING)).thenReturn(0L);
        when(tutorAuthorizationStateRepository.findByTutorProfileId(55L)).thenReturn(Optional.of(tutorState(200L)));
        when(enrollmentRequestRepository.save(any(EnrollmentRequest.class))).thenAnswer(invocation -> {
            EnrollmentRequest request = invocation.getArgument(0);
            ReflectionTestUtils.setField(request, "id", 500L);
            return request;
        });

        service.enrollClass(10L, "student@example.com", 100L, new EnrollClassRequest(null, "note", "An"));

        verify(eventPublisher).publishEnrollmentRequested(500L, 10L, 200L, 100L, "Math 10", "An");
    }

    @Test
    void acceptRequestPublishesEnrollmentAcceptedToStudent() {
        EnrollmentRequestService service = service();
        ClassRoom classRoom = classRoom();
        EnrollmentRequest request = request(classRoom, 500L, 100L, EnrollmentRequestStatus.PENDING);
        when(enrollmentRequestRepository.findById(500L)).thenReturn(Optional.of(request));
        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(classRoom));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.save(request)).thenReturn(request);

        service.acceptRequest(500L, "tutor@example.com", 200L);

        verify(eventPublisher).publishEnrollmentAccepted(500L, 10L, 100L, 200L, "Math 10", "An");
    }

    @Test
    void rejectRequestPublishesEnrollmentRejectedToStudent() {
        EnrollmentRequestService service = service();
        ClassRoom classRoom = classRoom();
        EnrollmentRequest request = request(classRoom, 500L, 100L, EnrollmentRequestStatus.PENDING);
        when(enrollmentRequestRepository.findById(500L)).thenReturn(Optional.of(request));
        when(enrollmentRequestRepository.save(request)).thenReturn(request);

        service.rejectRequest(500L, "tutor@example.com", 200L, "Không phù hợp lịch học");

        verify(eventPublisher).publishEnrollmentRejected(
                500L,
                10L,
                100L,
                200L,
                "Math 10",
                "Không phù hợp lịch học",
                "An"
        );
    }

    @Test
    void cancelRequestPublishesEnrollmentCancelledToTutor() {
        EnrollmentRequestService service = service();
        ClassRoom classRoom = classRoom();
        EnrollmentRequest request = request(classRoom, 500L, 100L, EnrollmentRequestStatus.PENDING);
        when(enrollmentRequestRepository.findById(500L)).thenReturn(Optional.of(request));
        when(enrollmentRequestRepository.save(request)).thenReturn(request);
        when(tutorAuthorizationStateRepository.findByTutorProfileId(55L)).thenReturn(Optional.of(tutorState(200L)));

        service.cancelRequest(500L, "student@example.com", 100L);

        verify(eventPublisher).publishEnrollmentCancelled(500L, 10L, 200L, 100L, "Math 10", "An");
    }

    @Test
    void failedEnrollDoesNotPublishEvent() {
        EnrollmentRequestService service = service();
        ClassRoom classRoom = classRoom();
        when(classRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(classRoom));
        when(enrollmentRequestRepository.countByClassRoomIdAndStatus(10L, EnrollmentRequestStatus.ACCEPTED)).thenReturn(0L);
        when(enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(
                ArgumentMatchers.eq(10L),
                ArgumentMatchers.eq("student@example.com"),
                any()
        )).thenReturn(true);

        assertThatThrownBy(() -> service.enrollClass(10L, "student@example.com", 100L, null))
                .isInstanceOf(BadRequestException.class);

        verify(eventPublisher, never()).publishEnrollmentRequested(any(), any(), any(), any(), any(), any());
    }

    private EnrollmentRequestService service() {
        return new EnrollmentRequestService(
                classRoomRepository,
                enrollmentRequestRepository,
                tutorAuthorizationStateRepository,
                eventPublisher
        );
    }

    private ClassRoom classRoom() {
        ClassRoom classRoom = new ClassRoom();
        ReflectionTestUtils.setField(classRoom, "id", 10L);
        classRoom.setName("Math 10");
        classRoom.setTutorEmail("tutor@example.com");
        classRoom.setTutorProfileId(55L);
        classRoom.setStatus(ClassRoomStatus.PUBLISHED);
        classRoom.setJoinMode(JoinMode.OPEN_REQUEST);
        classRoom.setStartDate(LocalDate.now().plusDays(10));
        classRoom.setMaxStudents(2);
        classRoom.setMaxPendingRequests(3);
        return classRoom;
    }

    private EnrollmentRequest request(ClassRoom classRoom, Long id, Long studentUserId, EnrollmentRequestStatus status) {
        EnrollmentRequest request = new EnrollmentRequest();
        ReflectionTestUtils.setField(request, "id", id);
        request.setClassRoom(classRoom);
        request.setStudentEmail("student@example.com");
        request.setStudentUserId(studentUserId);
        request.setStudentName("An");
        request.setStatus(status);
        return request;
    }

    private TutorAuthorizationState tutorState(Long userId) {
        TutorAuthorizationState state = new TutorAuthorizationState();
        state.setUserId(userId);
        state.setStatus("APPROVED");
        state.setTutorProfileId(55L);
        return state;
    }
}
