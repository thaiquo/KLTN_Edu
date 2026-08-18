package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.repository.CatalogLevelRepository;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.TutorSubjectRegistrationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
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

    private ClassRoom classRoom(String tutorEmail, ClassRoomStatus status) {
        ClassRoom classRoom = new ClassRoom();
        classRoom.setTutorEmail(tutorEmail);
        classRoom.setStatus(status);
        return classRoom;
    }
}
