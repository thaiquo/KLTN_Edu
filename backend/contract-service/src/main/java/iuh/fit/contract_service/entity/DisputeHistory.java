package iuh.fit.contract_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.FetchType;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "dispute_history")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class DisputeHistory {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "dispute_id", nullable = false)
    private Dispute dispute;

    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Column(name = "actor_email")
    private String actorEmail;

    @Column(name = "actor_role", nullable = false, length = 20)
    private String actorRole;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(name = "from_state", length = 50)
    private String fromState;

    @Column(name = "to_state", length = 50)
    private String toState;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 180)
    private String idempotencyKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
