package iuh.fit.learning_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Table(name = "community_moderation_history")
@Getter @Setter @NoArgsConstructor
public class CommunityModerationHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "post_id") private CommunityPost post;
    @Column(name = "actor_user_id", nullable = false) private Long actorUserId;
    @Column(name = "actor_email") private String actorEmail;
    @Column(name = "actor_role", nullable = false, length = 20) private String actorRole;
    @Column(nullable = false, length = 30) private String action;
    @Column(name = "previous_post_status", length = 30) private String previousPostStatus;
    @Column(name = "new_post_status", length = 30) private String newPostStatus;
    @Column(name = "previous_moderation_status", length = 20) private String previousModerationStatus;
    @Column(name = "new_moderation_status", length = 20) private String newModerationStatus;
    @Column(nullable = false, columnDefinition = "TEXT") private String reason;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void create() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
