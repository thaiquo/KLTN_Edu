package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.EnrollClassRequest;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class EnrollmentRequestServiceIdentityTest {

    private final ClassRoomRepository classRoomRepository = mock(ClassRoomRepository.class);
    private final EnrollmentRequestRepository enrollmentRequestRepository = mock(EnrollmentRequestRepository.class);
    private final EnrollmentRequestService service =
            new EnrollmentRequestService(classRoomRepository, enrollmentRequestRepository);

    @Test
    void rejectsEnrollmentWhenJwtDoesNotContainStudentId() {
        EnrollClassRequest request = new EnrollClassRequest(null, null, "Nguyễn Văn An", "0900000000");

        assertThatThrownBy(() -> service.enrollClass(1L, null, "student@example.com", request))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(classRoomRepository, enrollmentRequestRepository);
    }

    @Test
    void rejectsEnrollmentWithoutRealStudentName() {
        EnrollClassRequest request = new EnrollClassRequest(null, null, "student@example.com", "0900000000");

        assertThatThrownBy(() -> service.enrollClass(1L, 10L, "student@example.com", request))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(classRoomRepository, enrollmentRequestRepository);
    }

    @Test
    void rejectsEnrollmentWithoutStudentPhone() {
        EnrollClassRequest request = new EnrollClassRequest(null, null, "Nguyễn Văn An", " ");

        assertThatThrownBy(() -> service.enrollClass(1L, 10L, "student@example.com", request))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(classRoomRepository, enrollmentRequestRepository);
    }
}
