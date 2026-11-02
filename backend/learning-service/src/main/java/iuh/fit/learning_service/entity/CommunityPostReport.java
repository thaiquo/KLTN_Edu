package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.CommunityReportStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Table(name = "community_post_reports")
@Getter @Setter @NoArgsConstructor
public class CommunityPostReport {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "post_id") private CommunityPost post;
    @Column(name = "reporter_user_id", nullable = false) private Long reporterUserId;
    @Column(name = "reporter_role", nullable = false, length = 20) private String reporterRole;
    @Column(nullable = false, length = 80) private String reason;
    @Column(columnDefinition = "TEXT") private String details;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private CommunityReportStatus status;
    @Column(name = "resolved_by_user_id") private Long resolvedByUserId;
    @Column(name = "resolved_by_role", length = 20) private String resolvedByRole;
    @Column(name = "resolved_at") private LocalDateTime resolvedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void create() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
