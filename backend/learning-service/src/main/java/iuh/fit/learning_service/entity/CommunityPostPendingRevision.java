package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.CommunityModerationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "community_post_pending_revisions")
@Getter
@Setter
@NoArgsConstructor
public class CommunityPostPendingRevision {
    @Id
    @Column(name = "post_id")
    private Long postId;

    @Column(name = "content_revision", nullable = false)
    private Long contentRevision;

    @Column(name = "request_json", nullable = false, columnDefinition = "TEXT")
    private String requestJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 20)
    private CommunityModerationStatus moderationStatus;

    @Column(name = "moderation_categories", columnDefinition = "TEXT")
    private String moderationCategories;

    @Column(name = "moderation_reason", length = 500)
    private String moderationReason;

    @Column(name = "moderation_prompt_version", length = 100)
    private String moderationPromptVersion;

    @Column(name = "moderated_at")
    private LocalDateTime moderatedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
