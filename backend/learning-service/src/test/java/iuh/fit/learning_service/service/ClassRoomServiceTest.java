package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.TutorAuthorizationState;
import iuh.fit.learning_service.enums.ClassRoomStatus;
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

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

    private ClassRoom classRoom(String tutorEmail, ClassRoomStatus status) {
        ClassRoom classRoom = new ClassRoom();
        classRoom.setTutorEmail(tutorEmail);
        classRoom.setStatus(status);
        return classRoom;
    }
}
