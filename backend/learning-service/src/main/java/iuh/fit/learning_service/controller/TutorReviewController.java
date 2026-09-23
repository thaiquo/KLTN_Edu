package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.TutorReviewDtos;
import iuh.fit.learning_service.service.TutorReviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class TutorReviewController {
    private final TutorReviewService tutorReviewService;

    public TutorReviewController(TutorReviewService tutorReviewService) {
        this.tutorReviewService = tutorReviewService;
    }

    @GetMapping({"/api/reviews/classes/{classRoomId}/my", "/api/v1/reviews/classes/{classRoomId}/my"})
    @PreAuthorize("hasRole('STUDENT')")
    public TutorReviewDtos.MyReviewStatusResponse getMyReviewStatus(
            Authentication authentication,
            @PathVariable Long classRoomId
    ) {
        return tutorReviewService.getMyReviewStatus(classRoomId, currentUserId(authentication));
    }

    @PostMapping({"/api/reviews/classes/{classRoomId}/my", "/api/v1/reviews/classes/{classRoomId}/my"})
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<TutorReviewDtos.ReviewResponse> createReview(
            Authentication authentication,
            @PathVariable Long classRoomId,
            @Valid @RequestBody TutorReviewDtos.ReviewRequest request
    ) {
        TutorReviewDtos.ReviewResponse response = tutorReviewService.createReview(
                classRoomId,
                currentUserId(authentication),
                request
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping({"/api/reviews/classes/{classRoomId}/my", "/api/v1/reviews/classes/{classRoomId}/my"})
    @PreAuthorize("hasRole('STUDENT')")
    public TutorReviewDtos.ReviewResponse updateReview(
            Authentication authentication,
            @PathVariable Long classRoomId,
            @Valid @RequestBody TutorReviewDtos.ReviewRequest request
    ) {
        return tutorReviewService.updateReview(classRoomId, currentUserId(authentication), request);
    }

    @GetMapping("/api/public/tutors/{tutorId}/reviews")
    public TutorReviewDtos.ReviewPageResponse getTutorReviews(
            @PathVariable Long tutorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return tutorReviewService.getTutorReviews(tutorId, page, size);
    }

    @GetMapping("/api/public/tutors/{tutorId}/rating-summary")
    public TutorReviewDtos.RatingSummaryResponse getRatingSummary(@PathVariable Long tutorId) {
        return tutorReviewService.getRatingSummary(tutorId);
    }

    @GetMapping("/api/public/tutors/rating-summaries")
    public Map<Long, TutorReviewDtos.RatingSummaryResponse> getRatingSummaries(@RequestParam List<Long> tutorIds) {
        return tutorReviewService.getRatingSummaries(tutorIds);
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof LearningUserPrincipal principal) {
            return principal.userId();
        }
        return null;
    }
}
