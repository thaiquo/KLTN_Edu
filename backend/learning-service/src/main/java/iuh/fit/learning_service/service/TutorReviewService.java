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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class TutorReviewService {
    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 50;

    private final TutorReviewRepository tutorReviewRepository;
    private final ClassRoomRepository classRoomRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;
    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository;

    public TutorReviewService(
            TutorReviewRepository tutorReviewRepository,
            ClassRoomRepository classRoomRepository,
            EnrollmentRequestRepository enrollmentRequestRepository,
            SessionAttendanceRepository sessionAttendanceRepository,
            TutorAuthorizationStateRepository tutorAuthorizationStateRepository
    ) {
        this.tutorReviewRepository = tutorReviewRepository;
        this.classRoomRepository = classRoomRepository;
        this.enrollmentRequestRepository = enrollmentRequestRepository;
        this.sessionAttendanceRepository = sessionAttendanceRepository;
        this.tutorAuthorizationStateRepository = tutorAuthorizationStateRepository;
    }

    @Transactional(readOnly = true)
    public TutorReviewDtos.MyReviewStatusResponse getMyReviewStatus(Long classRoomId, Long studentId) {
        requireStudentId(studentId);
        classRoomRepository.findById(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học."));
        TutorReviewDtos.ReviewResponse review = tutorReviewRepository
                .findByStudentIdAndClassRoomId(studentId, classRoomId)
                .map(this::toResponse)
                .orElse(null);
        Eligibility eligibility = checkEligibility(classRoomId, studentId);
        return new TutorReviewDtos.MyReviewStatusResponse(
                eligibility.canReview(),
                review != null,
                eligibility.reason(),
                review
        );
    }

    public TutorReviewDtos.ReviewResponse createReview(Long classRoomId, Long studentId, TutorReviewDtos.ReviewRequest request) {
        requireStudentId(studentId);
        validatePayload(request);
        ClassRoom classRoom = classRoomRepository.findByIdWithDetails(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học."));
        Eligibility eligibility = checkEligibility(classRoomId, studentId);
        if (!eligibility.canReview()) {
            throw new ForbiddenException(eligibility.reason());
        }
        if (tutorReviewRepository.existsByStudentIdAndClassRoomId(studentId, classRoomId)) {
            throw new ConflictException("Bạn đã đánh giá gia sư cho lớp học này.");
        }

        TutorReview review = new TutorReview();
        review.setStudentId(studentId);
        review.setTutorId(resolveTutorUserId(classRoom));
        review.setClassRoom(classRoom);
        review.setRating(request.rating());
        review.setComment(normalizeComment(request.comment()));
        try {
            return toResponse(tutorReviewRepository.save(review));
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Bạn đã đánh giá gia sư cho lớp học này.");
        }
    }

    public TutorReviewDtos.ReviewResponse updateReview(Long classRoomId, Long studentId, TutorReviewDtos.ReviewRequest request) {
        requireStudentId(studentId);
        validatePayload(request);
        TutorReview review = tutorReviewRepository.findByStudentIdAndClassRoomId(studentId, classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đánh giá của bạn cho lớp học này."));
        if (!review.getStudentId().equals(studentId)) {
            throw new ForbiddenException("Bạn không có quyền cập nhật đánh giá này.");
        }
        review.setRating(request.rating());
        review.setComment(normalizeComment(request.comment()));
        return toResponse(tutorReviewRepository.save(review));
    }

    @Transactional(readOnly = true)
    public TutorReviewDtos.RatingSummaryResponse getRatingSummary(Long tutorId) {
        double average = safeAverage(tutorReviewRepository.averageRatingByTutorId(tutorId));
        long count = tutorReviewRepository.countByTutorId(tutorId);
        return new TutorReviewDtos.RatingSummaryResponse(tutorId, average, count);
    }

    @Transactional(readOnly = true)
    public Map<Long, TutorReviewDtos.RatingSummaryResponse> getRatingSummaries(Collection<Long> tutorIds) {
        if (tutorIds == null || tutorIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, TutorReviewDtos.RatingSummaryResponse> result = new HashMap<>();
        tutorIds.stream().filter(id -> id != null).distinct()
                .forEach(id -> result.put(id, new TutorReviewDtos.RatingSummaryResponse(id, 0.0, 0)));
        tutorReviewRepository.summarizeByTutorIds(result.keySet()).forEach(row -> result.put(
                row.getTutorId(),
                new TutorReviewDtos.RatingSummaryResponse(
                        row.getTutorId(),
                        safeAverage(row.getAverageRating()),
                        row.getReviewCount() == null ? 0 : row.getReviewCount()
                )
        ));
        return result;
    }

    @Transactional(readOnly = true)
    public TutorReviewDtos.ReviewPageResponse getTutorReviews(Long tutorId, int page, int size) {
        int normalizedPage = Math.max(page, 0);
        int normalizedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(normalizedPage, normalizedSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<TutorReview> reviews = tutorReviewRepository.findByTutorIdOrderByCreatedAtDesc(tutorId, pageable);
        List<TutorReviewDtos.ReviewResponse> content = reviews.getContent().stream().map(this::toResponse).toList();
        return new TutorReviewDtos.ReviewPageResponse(
                content,
                reviews.getNumber(),
                reviews.getSize(),
                reviews.getTotalElements(),
                reviews.getTotalPages(),
                reviews.isLast()
        );
    }

    private Eligibility checkEligibility(Long classRoomId, Long studentId) {
        boolean enrolled = enrollmentRequestRepository
                .findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                        classRoomId,
                        studentId,
                        List.of(EnrollmentRequestStatus.ENROLLED))
                .isPresent();
        if (!enrolled) {
            return new Eligibility(false, "Bạn chưa đủ điều kiện đánh giá gia sư.");
        }
        long attendedCompletedSession = sessionAttendanceRepository.countCompletedOutcomeForStudent(
                classRoomId,
                studentId,
                ClassSessionStatus.COMPLETED,
                AttendanceOutcome.BOTH_PRESENT
        );
        if (attendedCompletedSession < 1) {
            return new Eligibility(false, "Bạn có thể đánh giá gia sư sau khi hoàn thành ít nhất một buổi học.");
        }
        return new Eligibility(true, "Bạn đủ điều kiện đánh giá gia sư.");
    }

    private Long resolveTutorUserId(ClassRoom classRoom) {
        if (classRoom.getTutorProfileId() == null) {
            throw new BadRequestException("Không thể xác định hồ sơ gia sư của lớp học.");
        }
        TutorAuthorizationState state = tutorAuthorizationStateRepository.findByTutorProfileId(classRoom.getTutorProfileId())
                .orElseThrow(() -> new BadRequestException("Không thể xác định tài khoản gia sư của lớp học."));
        return state.getUserId();
    }

    private void requireStudentId(Long studentId) {
        if (studentId == null) {
            throw new ForbiddenException("Bạn cần đăng nhập bằng tài khoản học viên để đánh giá gia sư.");
        }
    }

    private void validatePayload(TutorReviewDtos.ReviewRequest request) {
        if (request == null || request.rating() == null || request.rating() < 1 || request.rating() > 5) {
            throw new BadRequestException("Điểm đánh giá phải từ 1 đến 5 sao.");
        }
        String comment = normalizeComment(request.comment());
        if (comment.length() < 10 || comment.length() > 1000) {
            throw new BadRequestException("Nhận xét phải có từ 10 đến 1000 ký tự.");
        }
    }

    private String normalizeComment(String comment) {
        return comment == null ? "" : comment.trim();
    }

    private double safeAverage(Double average) {
        return average == null ? 0.0 : average;
    }

    private TutorReviewDtos.ReviewResponse toResponse(TutorReview review) {
        return new TutorReviewDtos.ReviewResponse(
                review.getId(),
                review.getStudentId(),
                review.getTutorId(),
                review.getClassRoom().getId(),
                review.getRating(),
                review.getComment(),
                review.getCreatedAt(),
                review.getUpdatedAt()
        );
    }

    private record Eligibility(boolean canReview, String reason) {}
}
