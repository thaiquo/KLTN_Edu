package iuh.fit.account_service.modules.auth.entity;

import iuh.fit.account_service.shared.enums.AccountStatus;
import iuh.fit.account_service.shared.enums.Role;
import iuh.fit.account_service.modules.role.entity.RoleEntity;
import iuh.fit.account_service.modules.role.entity.UserRole;
import iuh.fit.account_service.modules.role.enums.UserRoleStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "accounts", indexes = {
    @Index(name = "idx_accounts_status", columnList = "status"),
    @Index(name = "idx_accounts_created_at", columnList = "created_at")
})
public class Account {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private Set<UserRole> userRoles = new LinkedHashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AccountStatus status = AccountStatus.PENDING_VERIFICATION;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount = 0;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "token_version", nullable = false)
    private long tokenVersion = 0L;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @OneToOne(mappedBy = "account")
    private AccountProfile profile;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        normalize();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
        normalize();
    }

    private void normalize() {
        if (email != null) {
            email = email.trim().toLowerCase();
        }
    }

    public Set<Role> getRoles() {
        return userRoles.stream()
            .filter(userRole -> userRole.getStatus() == UserRoleStatus.ACTIVE)
            .map(userRole -> userRole.getRole().getName())
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public void assignRole(RoleEntity role, UUID assignedBy) {
        boolean alreadyAssigned = userRoles.stream()
            .anyMatch(userRole -> userRole.getRole().getName() == role.getName()
                && userRole.getStatus() == UserRoleStatus.ACTIVE);
        if (!alreadyAssigned) {
            userRoles.add(new UserRole(this, role, assignedBy));
        }
    }

    /** Compatibility helper for isolated tests; production code assigns persisted RoleEntity values. */
    public void setRole(Role role) {
        assignRole(new RoleEntity(role), null);
    }

    public Role getRole() {
        return getRoles().stream().findFirst().orElse(Role.STUDENT);
    }
}
