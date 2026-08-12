package iuh.fit.account_service.modules.role.entity;

import iuh.fit.account_service.modules.auth.entity.Account;
import iuh.fit.account_service.modules.role.enums.UserRoleStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "account_user_roles", uniqueConstraints = {
    @UniqueConstraint(name = "uk_account_user_roles_user_role", columnNames = {"user_id", "role_id"})
})
public class UserRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private Account user;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "role_id", nullable = false)
    private RoleEntity role;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @Column(name = "assigned_by")
    private UUID assignedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRoleStatus status = UserRoleStatus.ACTIVE;

    protected UserRole() {
    }

    public UserRole(Account user, RoleEntity role, UUID assignedBy) {
        this.user = user;
        this.role = role;
        this.assignedBy = assignedBy;
    }

    @PrePersist
    void prePersist() {
        if (assignedAt == null) {
            assignedAt = Instant.now();
        }
    }

    public RoleEntity getRole() {
        return role;
    }

    public UserRoleStatus getStatus() {
        return status;
    }
}
