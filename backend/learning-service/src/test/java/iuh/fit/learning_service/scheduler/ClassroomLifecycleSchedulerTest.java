package iuh.fit.learning_service.scheduler;

import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.service.ClassroomLifecycleService;
import iuh.fit.learning_service.service.SessionAttendanceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClassroomLifecycleSchedulerTest {

    @Mock
    private ClassRoomRepository classRoomRepository;

    @Mock
    private ClassroomLifecycleService classroomLifecycleService;

    @Mock
    private SessionAttendanceService sessionAttendanceService;

    private ClassroomLifecycleScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new ClassroomLifecycleScheduler(
                classRoomRepository,
                classroomLifecycleService,
                sessionAttendanceService
        );
    }

    @Test
    void scanAndLockProcessesEachCandidateSeparatelyAndContinuesOnError() {
        when(classRoomRepository.findStartingClassroomCandidateIds(eq(ClassRoomStatus.PUBLISHED), eq(ClassRoomStatus.ACTIVE), any(LocalDate.class)))
                .thenReturn(List.of(101L, 102L, 103L));

        doThrow(new RuntimeException("Simulated lock timeout on classroom 101"))
                .when(classroomLifecycleService).processStartingClassroom(eq(101L), any(LocalDate.class));

        scheduler.scanAndLockStartingClassrooms();

        // 101 failed, but 102 and 103 must still be processed
        verify(classroomLifecycleService).processStartingClassroom(eq(101L), any(LocalDate.class));
        verify(classroomLifecycleService).processStartingClassroom(eq(102L), any(LocalDate.class));
        verify(classroomLifecycleService).processStartingClassroom(eq(103L), any(LocalDate.class));
    }
}
