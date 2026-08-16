package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.SubjectRequestStatus;
import iuh.fit.learning_service.enums.TeachingLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

public final class SubjectRequestDtos {
    private SubjectRequestDtos() {
    }

    public static class CreateRequest {
        @NotBlank
        @Size(max = 160)
        private String requestedName;
        @NotNull
        private Long categoryId;
        private Long groupId;
        @NotNull
        private Long requestedByUserId;
        @Size(max = 1000)
        private String note;
        @NotEmpty
        private Set<TeachingLevel> levels = new LinkedHashSet<>();

        public String getRequestedName() { return requestedName; }
        public void setRequestedName(String requestedName) { this.requestedName = requestedName; }
        public Long getCategoryId() { return categoryId; }
        public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
        public Long getGroupId() { return groupId; }
        public void setGroupId(Long groupId) { this.groupId = groupId; }
        public Long getRequestedByUserId() { return requestedByUserId; }
        public void setRequestedByUserId(Long requestedByUserId) { this.requestedByUserId = requestedByUserId; }
        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
        public Set<TeachingLevel> getLevels() { return levels; }
        public void setLevels(Set<TeachingLevel> levels) { this.levels = levels == null ? new LinkedHashSet<>() : levels; }
    }

    public static class RejectRequest {
        @NotBlank
        @Size(max = 1000)
        private String reason;
        private Long reviewedByUserId;

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public Long getReviewedByUserId() { return reviewedByUserId; }
        public void setReviewedByUserId(Long reviewedByUserId) { this.reviewedByUserId = reviewedByUserId; }
    }

    public record Response(
            Long id,
            String requestedName,
            SubjectDtos.CategoryResponse category,
            SubjectDtos.GroupResponse group,
            Long requestedByUserId,
            Set<TeachingLevel> levels,
            String note,
            SubjectRequestStatus status,
            Long reviewedByUserId,
            LocalDateTime reviewedAt,
            String rejectReason,
            SubjectDtos.SubjectResponse approvedSubject,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }
}
