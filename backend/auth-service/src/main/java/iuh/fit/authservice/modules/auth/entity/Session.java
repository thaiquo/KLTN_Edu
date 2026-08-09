package iuh.fit.authservice.modules.auth.entity;

import iuh.fit.authservice.shared.enums.SessionStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "sessions", indexes = {
    @Index(name = "idx_sessions_account_id", columnList = "account_id"),
    @Index(name = "idx_sessions_status", columnList = "status")
})
public class Session {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(name = "device_name", length = 255)
    private String deviceName;

    @Column(name = "browser", length = 255)
    private String browser;

    @Column(name = "os", length = 255)
    private String os;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "login_at", nullable = false)
    private Instant loginAt;

    @Column(name = "last_activity_at", nullable = false)
    private Instant lastActivityAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private SessionStatus status = SessionStatus.ACTIVE;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (loginAt == null) {
            loginAt = now;
        }
        if (lastActivityAt == null) {
            lastActivityAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}