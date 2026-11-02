package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.enums.PostStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public final class CommunityModerationDtos {
    private CommunityModerationDtos() {}
    public record ReportRequest(@NotBlank @Size(max = 80) String reason, @Size(max = 2000) String details) {}
    public record ActionRequest(@NotNull Action action, @NotBlank @Size(max = 2000) String reason,
                                @NotNull Long expectedContentRevision, ModerationSource source) {
        public ActionRequest(Action action, String reason, Long expectedContentRevision) {
            this(action, reason, expectedContentRevision, null);
        }
    }
    public enum Action { APPROVE, REJECT, HIDE, RESTORE }
    public enum ModerationSource { USER_REPORT, AI_POST_REVIEW, AI_REVISION_REVIEW }
    public record Report(Long id, Long reporterUserId, String reporterRole, String reason, String details,
                         String status, LocalDateTime createdAt) {}
    public record History(Long id, Long actorUserId, String actorEmail, String actorRole, String action,
                          String previousPostStatus, String newPostStatus, String previousModerationStatus,
                          String newModerationStatus, String reason, LocalDateTime createdAt) {}
    public record QueueItem(Long postId, String title, String content, Long authorId, String authorName,
                            String authorRole, PostStatus postStatus, CommunityModerationStatus moderationStatus,
                            String moderationReason, List<String> moderationCategories, long contentRevision,
                            long openReportCount, LocalDateTime createdAt, LocalDateTime updatedAt,
                            ModerationSource source, Long revisionId, String currentTitle, String currentContent,
                            String proposedTitle, String proposedContent) {}
    public record Detail(QueueItem post, List<Report> reports, List<History> history) {}
}
