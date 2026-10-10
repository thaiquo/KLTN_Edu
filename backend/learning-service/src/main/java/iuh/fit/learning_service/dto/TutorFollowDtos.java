package iuh.fit.learning_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

public class TutorFollowDtos {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FollowStatusResponse {
        private Boolean isFollowed;
        private Long followerCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FollowingTutorSummaryDto {
        private Long tutorUserId;
        private LocalDateTime followedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FollowerSummaryDto {
        private Long studentUserId;
        private LocalDateTime followedAt;
    }
}
