package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.TutorAvailabilityRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TutorAvailabilityControllerTest {

    @Mock
    private TutorAvailabilityRepository repository;

    @Mock
    private ClassRoomRepository classRoomRepository;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private TutorAvailabilityController controller;

    @Test
    void saveReplacesTutorSlotsInDatabase() {
        when(authentication.getName()).thenReturn("tutor@example.com");
        when(classRoomRepository.findByTutorEmailWithDetails("tutor@example.com")).thenReturn(List.of());
        when(repository.saveAllAndFlush(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        var request = new TutorAvailabilityController.SaveAvailabilityRequest(List.of(
                slot(2, "07:00", "09:00"),
                slot(4, "10:00", "12:00"),
                slot(6, "13:00", "15:00")
        ));

        var response = controller.saveMyAvailability(authentication, request);

        assertEquals(3, response.size());
        verify(repository).deleteByTutorEmailIgnoreCase("tutor@example.com");
        verify(repository).saveAllAndFlush(anyList());
    }

    @Test
    void invalidScheduleDoesNotDeleteExistingDatabaseSlots() {
        when(authentication.getName()).thenReturn("tutor@example.com");
        var request = new TutorAvailabilityController.SaveAvailabilityRequest(List.of(
                slot(2, "07:00", "09:00"),
                slot(2, "08:00", "10:00"),
                slot(4, "13:00", "14:00")
        ));

        assertThrows(BadRequestException.class,
                () -> controller.saveMyAvailability(authentication, request));

        verify(repository, never()).deleteByTutorEmailIgnoreCase("tutor@example.com");
        verify(repository, never()).saveAllAndFlush(anyList());
    }

    private TutorAvailabilityController.AvailabilitySlotDto slot(int day, String start, String end) {
        return new TutorAvailabilityController.AvailabilitySlotDto(null, day, start, end);
    }
}
