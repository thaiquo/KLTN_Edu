package iuh.fit.account_service.entity;

import iuh.fit.account_service.enums.ShiftAuditAction;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "staff_shift_audits")
@Getter
@Setter
@NoArgsConstructor
public class StaffShiftAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false)
    private StaffShiftAssignment assignment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ShiftAuditAction action;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_staff_id")
    private User previousStaff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "new_staff_id")
    private User newStaff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    private User changedBy;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
