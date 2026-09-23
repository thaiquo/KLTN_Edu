package iuh.fit.learning_service.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public final class TutorReviewDtos {
    private TutorReviewDtos() {}

    public record ReviewRequest(
            @NotNull(message = "Vui lòng chọn số sao đánh giá.")
            @Min(value = 1, message = "Điểm đánh giá phải từ 1 đến 5 sao.")
            @Max(value = 5, message = "Điểm đánh giá phải từ 1 đến 5 sao.")
            Integer rating,

            @NotBlank(message = "Nhận xét phải có từ 10 đến 1000 ký tự.")
            @Size(min = 10, max = 1000, message = "Nhận xét phải có từ 10 đến 1000 ký tự.")
            String comment
    ) {}

    public record ReviewResponse(
            Long id,
            Long studentId,
            Long tutorId,
            Long classRoomId,
            Integer rating,
            String comment,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record MyReviewStatusResponse(
            boolean canReview,
            boolean reviewExists,
            String reason,
            ReviewResponse review
    ) {}

    public record RatingSummaryResponse(
            Long tutorId,
            Double averageRating,
            long reviewCount
    ) {}

    public record ReviewPageResponse(
            List<ReviewResponse> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean last
    ) {}
}
