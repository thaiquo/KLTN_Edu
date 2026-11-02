package iuh.fit.account_service.entity;

import iuh.fit.account_service.enums.SupportTicketCategory;
import iuh.fit.account_service.enums.SupportTicketStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "support_tickets")
@Getter
@Setter
@NoArgsConstructor
public class SupportTicket {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creator_user_id", nullable = false)
    private User creator;
    @Column(name = "creator_role", nullable = false, length = 20)
    private String creatorRole;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SupportTicketCategory category;
    @Column(nullable = false, length = 180)
    private String subject;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SupportTicketStatus status;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_user_id")
    private User assignee;
    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;
    @Version
    private Long version;
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist void create() {
        if (publicId == null) publicId = UUID.randomUUID();
        var now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }
    @PreUpdate void update() { updatedAt = LocalDateTime.now(); }
}
