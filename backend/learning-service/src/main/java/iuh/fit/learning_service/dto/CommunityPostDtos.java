package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.DurationUnit;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.enums.PostType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public class CommunityPostDtos {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreatePostRequest {
        @NotNull(message = "Loại bài đăng không được để trống")
        private PostType postType;

        @NotBlank(message = "Tiêu đề không được để trống")
        @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
        private String title;

        @NotBlank(message = "Nội dung bài viết không được để trống")
        @Size(max = 10000, message = "Nội dung bài viết không được vượt quá 10000 ký tự")
        private String content;

        private Long subjectId;
        @Size(max = 50, message = "Education level must not exceed 50 characters")
        private String educationLevel;
        private LearningMode learningMode;
        @DecimalMin(value = "0", inclusive = false, message = "Mức giá phải lớn hơn 0")
        private BigDecimal targetPricePerSession;
        @Size(max = 500, message = "Địa chỉ không được vượt quá 500 ký tự")
        private String address;

        // Cho bài khảo sát (Gia sư)
        @Valid
        private CreatePollRequest poll;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreatePollRequest {
        @NotBlank(message = "Câu hỏi khảo sát không được để trống")
        @Size(max = 255, message = "Câu hỏi khảo sát không được vượt quá 255 ký tự")
        private String question;
        @Min(value = 1, message = "Mục tiêu bình chọn phải lớn hơn 0")
        private Integer minVotesTarget;
        @Future(message = "Hạn khảo sát phải ở tương lai")
        private LocalDateTime expiresAt;
        @Size(min = 2, max = 20, message = "Khảo sát cần từ 2 đến 20 khung giờ")
        private List<@Valid CreatePollOptionRequest> options;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreatePollOptionRequest {
        @NotNull(message = "Thứ trong tuần không được để trống")
        @Min(value = 1, message = "Thứ trong tuần phải từ 1 đến 7")
        @Max(value = 7, message = "Thứ trong tuần phải từ 1 đến 7")
        private Integer dayOfWeek; // 1 = Monday, 7 = Sunday
        @NotNull(message = "Giờ bắt đầu không được để trống")
        private LocalTime startTime;
        @NotNull(message = "Giờ kết thúc không được để trống")
        private LocalTime endTime;
        @Size(max = 150, message = "Nhãn khung giờ không được vượt quá 150 ký tự")
        private String optionLabel;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PostSummaryDto {
        private Long id;
        private Long authorId;
        private String authorRole;
        private String authorName;
        private String authorAvatar;
        private PostType postType;
        private String title;
        private String content;
        private Long subjectId;
        private String subjectName;
        private String educationLevel;
        private LearningMode learningMode;
        private BigDecimal targetPricePerSession;
        private String address;
        private PostStatus status;
        private Long linkedClassId;
        private String linkedClassName;
        private String linkedClassStatus;
        private Integer likeCount;
        private Integer commentCount;
        private Integer viewCount;
        private Boolean isLiked;
        private Boolean isBookmarked;
        private PollSummaryDto poll;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PollSummaryDto {
        private Long id;
        private String question;
        private Integer minVotesTarget;
        private Integer totalVotes;
        private Boolean isClosed;
        private LocalDateTime expiresAt;
        private Long userVotedOptionId;
        private List<PollOptionDto> options;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PollOptionDto {
        private Long id;
        private Integer dayOfWeek;
        private LocalTime startTime;
        private LocalTime endTime;
        private String optionLabel;
        private Integer voteCount;
        private Double votePercentage;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VotePollRequest {
        @NotNull(message = "Vui lòng chọn khung giờ để bình chọn")
        private Long optionId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateCommentRequest {
        @NotBlank(message = "Nội dung bình luận không được để trống")
        @Size(max = 2000, message = "Bình luận không được vượt quá 2000 ký tự")
        private String commentText;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommentDto {
        private Long id;
        private Long userId;
        private String userRole;
        private String userName;
        private String userAvatar;
        private String commentText;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConvertPostToClassRequest {
        @NotNull(message = "Vui lòng chọn ca học từ khảo sát để tạo lịch cố định")
        private Long selectedOptionId;

        private Long tutorSubjectRegistrationId;
        private Long levelId;
        @Size(max = 255, message = "Tên lớp không được vượt quá 255 ký tự")
        private String name;
        @Size(max = 10000, message = "Mô tả lớp không được vượt quá 10000 ký tự")
        private String description;

        @Min(value = 1, message = "Sĩ số phải lớn hơn 0")
        @Max(value = 100, message = "Sĩ số không được vượt quá 100")
        private Integer maxCapacity;
        @Min(value = 1, message = "Sĩ số phải lớn hơn 0")
        @Max(value = 100, message = "Sĩ số không được vượt quá 100")
        private Integer maxStudents;

        private LocalDate startDate;
        @Min(value = 1, message = "Tổng số buổi phải lớn hơn 0")
        private Integer totalSessions;
        @Min(value = 1, message = "Thời lượng khóa học phải lớn hơn 0")
        @Max(value = 52, message = "Thời lượng khóa học không được vượt quá 52 đơn vị")
        private Integer durationValue;
        private DurationUnit durationUnit;
        @Min(value = 1, message = "Số buổi mỗi tuần phải lớn hơn 0")
        @Max(value = 7, message = "Số buổi mỗi tuần không được vượt quá 7")
        private Integer sessionsPerWeek;

        @DecimalMin(value = "1", message = "Học phí phải lớn hơn 0")
        private BigDecimal pricePerSession;
        @Size(max = 500, message = "Link phòng học không được vượt quá 500 ký tự")
        private String meetingLink;
        @Size(max = 500, message = "Địa chỉ không được vượt quá 500 ký tự")
        private String address;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClassCreatedFromPostResponse {
        private Long postId;
        private Long classId;
        private String className;
        private String status;
        private int notifiedStudentsCount;
    }
}
