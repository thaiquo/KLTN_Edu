package iuh.fit.account_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Table(name = "support_ticket_history")
@Getter @Setter @NoArgsConstructor
public class SupportTicketHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "ticket_id") private SupportTicket ticket;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "actor_user_id") private User actor;
    @Column(name = "actor_role", nullable = false, length = 20) private String actorRole;
    @Column(nullable = false, length = 40) private String action;
    @Column(name = "from_status", length = 30) private String fromStatus;
    @Column(name = "to_status", length = 30) private String toStatus;
    @Column(columnDefinition = "TEXT") private String reason;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void create() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
