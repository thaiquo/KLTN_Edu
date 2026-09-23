package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TutorReviewDtos;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.TutorAuthorizationState;
import iuh.fit.learning_service.entity.TutorReview;
import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import iuh.fit.learning_service.repository.TutorReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TutorReviewServiceTest {
    @Mock private TutorReviewRepository tutorReviewRepository;
    @Mock private ClassRoomRepository classRoomRepository;
    @Mock private EnrollmentRequestRepository enrollmentRequestRepository;
    @Mock private SessionAttendanceRepository sessionAttendanceRepository;
    @Mock private TutorAuthorizationStateRepository tutorAuthorizationStateRepository;

    @InjectMocks
    private TutorReviewService tutorReviewService;

    private ClassRoom classRoom;
    private TutorAuthorizationState tutorState;

    @BeforeEach
    void setUp() {
        classRoom = new ClassRoom();
        classRoom.setId(100L);
        classRoom.setTutorProfileId(20L);
        tutorState = new TutorAuthorizationState();
        tutorState.setUserId(900L);
        tutorState.setTutorProfileId(20L);
        tutorState.setStatus("APPROVED");
    }

    @Test
    @DisplayName("student must be enrolled and have a completed BOTH_PRESENT attendance to create review")
    void createRequiresEnrolledAndBothPresentAttendance() {
        when(classRoomRepository.findByIdWithDetails(100L)).thenReturn(Optional.of(classRoom));
        when(enrollmentRequestRepository.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                100L, 501L, List.of(EnrollmentRequestStatus.ENROLLED))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tutorReviewService.createReview(100L, 501L,
                new TutorReviewDtos.ReviewRequest(5, "Gia sư dạy rất dễ hiểu.")))
                .isInstanceOf(ForbiddenException.class);
        verify(tutorReviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("completed session with non BOTH_PRESENT outcome is not eligible")
    void createRejectsNonBothPresentOutcome() {
        when(classRoomRepository.findByIdWithDetails(100L)).thenReturn(Optional.of(classRoom));
        when(enrollmentRequestRepository.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                100L, 501L, List.of(EnrollmentRequestStatus.ENROLLED))).thenReturn(Optional.of(mockEnrollment()));
        when(sessionAttendanceRepository.countCompletedOutcomeForStudent(
                100L, 501L, ClassSessionStatus.COMPLETED, AttendanceOutcome.BOTH_PRESENT)).thenReturn(0L);

        assertThatThrownBy(() -> tutorReviewService.createReview(100L, 501L,
                new TutorReviewDtos.ReviewRequest(5, "Gia sư dạy rất dễ hiểu.")))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("eligible student creates review with backend-derived tutor user id")
    void createSuccessDerivesTutorId() {
        when(classRoomRepository.findByIdWithDetails(100L)).thenReturn(Optional.of(classRoom));
        when(enrollmentRequestRepository.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                100L, 501L, List.of(EnrollmentRequestStatus.ENROLLED))).thenReturn(Optional.of(mockEnrollment()));
        when(sessionAttendanceRepository.countCompletedOutcomeForStudent(
                100L, 501L, ClassSessionStatus.COMPLETED, AttendanceOutcome.BOTH_PRESENT)).thenReturn(1L);
        when(tutorReviewRepository.existsByStudentIdAndClassRoomId(501L, 100L)).thenReturn(false);
        when(tutorAuthorizationStateRepository.findByTutorProfileId(20L)).thenReturn(Optional.of(tutorState));
        when(tutorReviewRepository.save(any(TutorReview.class))).thenAnswer(invocation -> {
            TutorReview review = invocation.getArgument(0);
            review.setId(1L);
            return review;
        });

        TutorReviewDtos.ReviewResponse response = tutorReviewService.createReview(100L, 501L,
                new TutorReviewDtos.ReviewRequest(4, "Gia sư hỗ trợ rất tận tâm."));

        assertThat(response.tutorId()).isEqualTo(900L);
        assertThat(response.studentId()).isEqualTo(501L);
        assertThat(response.classRoomId()).isEqualTo(100L);
        assertThat(response.rating()).isEqualTo(4);
    }

    @Test
    @DisplayName("second review for same student and classroom is rejected")
    void duplicateReviewRejected() {
        when(classRoomRepository.findByIdWithDetails(100L)).thenReturn(Optional.of(classRoom));
        when(enrollmentRequestRepository.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                100L, 501L, List.of(EnrollmentRequestStatus.ENROLLED))).thenReturn(Optional.of(mockEnrollment()));
        when(sessionAttendanceRepository.countCompletedOutcomeForStudent(
                100L, 501L, ClassSessionStatus.COMPLETED, AttendanceOutcome.BOTH_PRESENT)).thenReturn(1L);
        when(tutorReviewRepository.existsByStudentIdAndClassRoomId(501L, 100L)).thenReturn(true);

        assertThatThrownBy(() -> tutorReviewService.createReview(100L, 501L,
                new TutorReviewDtos.ReviewRequest(5, "Gia sư dạy rất dễ hiểu.")))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("student updates only own existing review")
    void updateOwnReview() {
        TutorReview review = existingReview(501L);
        when(tutorReviewRepository.findByStudentIdAndClassRoomId(501L, 100L)).thenReturn(Optional.of(review));
        when(tutorReviewRepository.save(review)).thenReturn(review);

        TutorReviewDtos.ReviewResponse response = tutorReviewService.updateReview(100L, 501L,
                new TutorReviewDtos.ReviewRequest(2, "Cần chuẩn bị tài liệu rõ hơn."));

        assertThat(response.rating()).isEqualTo(2);
        assertThat(response.comment()).isEqualTo("Cần chuẩn bị tài liệu rõ hơn.");
    }

    @Test
    @DisplayName("rating and comment validation rejects invalid input")
    void validationRejectsInvalidInput() {
        assertThatThrownBy(() -> tutorReviewService.createReview(100L, 501L,
                new TutorReviewDtos.ReviewRequest(0, "Gia sư dạy tốt.")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> tutorReviewService.createReview(100L, 501L,
                new TutorReviewDtos.ReviewRequest(5, "   ")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> tutorReviewService.createReview(100L, 501L,
                new TutorReviewDtos.ReviewRequest(5, "quá ngắn")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("summary reports zero when there are no reviews")
    void summaryNoReviews() {
        when(tutorReviewRepository.averageRatingByTutorId(900L)).thenReturn(null);
        when(tutorReviewRepository.countByTutorId(900L)).thenReturn(0L);

        TutorReviewDtos.RatingSummaryResponse response = tutorReviewService.getRatingSummary(900L);

        assertThat(response.averageRating()).isZero();
        assertThat(response.reviewCount()).isZero();
    }

    @Test
    @DisplayName("summary uses aggregate values from database")
    void summaryUsesAggregate() {
        when(tutorReviewRepository.averageRatingByTutorId(900L)).thenReturn(4.75);
        when(tutorReviewRepository.countByTutorId(900L)).thenReturn(4L);

        TutorReviewDtos.RatingSummaryResponse response = tutorReviewService.getRatingSummary(900L);

        assertThat(response.averageRating()).isEqualTo(4.75);
        assertThat(response.reviewCount()).isEqualTo(4);
    }

    private iuh.fit.learning_service.entity.EnrollmentRequest mockEnrollment() {
        return new iuh.fit.learning_service.entity.EnrollmentRequest();
    }

    private TutorReview existingReview(Long studentId) {
        TutorReview review = new TutorReview();
        review.setId(1L);
        review.setStudentId(studentId);
        review.setTutorId(900L);
        review.setClassRoom(classRoom);
        review.setRating(5);
        review.setComment("Gia sư dạy rất dễ hiểu.");
        return review;
    }
}
