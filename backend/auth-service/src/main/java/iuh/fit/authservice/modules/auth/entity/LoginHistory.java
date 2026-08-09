package iuh.fit.authservice.modules.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
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
@Table(name = "login_histories", indexes = {
    @Index(name = "idx_login_histories_account_id", columnList = "account_id"),
    @Index(name = "idx_login_histories_login_time", columnList = "login_time")
})
public class LoginHistory {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    @Column(name = "attempted_email", nullable = false, length = 255)
    private String attemptedEmail;

    @Column(nullable = false)
    private boolean success;

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "login_time", nullable = false)
    private Instant loginTime;

    @PrePersist
    void prePersist() {
        if (loginTime == null) {
            loginTime = Instant.now();
        }
    }
}