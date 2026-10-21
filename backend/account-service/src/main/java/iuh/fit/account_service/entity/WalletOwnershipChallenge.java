package iuh.fit.account_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "wallet_ownership_challenges")
public class WalletOwnershipChallenge {
    @Id
    private UUID id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "wallet_address", nullable = false)
    private String walletAddress;
    @Column(name = "challenge_text", nullable = false)
    private String challengeText;
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    protected WalletOwnershipChallenge() {}

    public WalletOwnershipChallenge(UUID id, Long userId, String walletAddress, String challengeText, LocalDateTime expiresAt) {
        this.id = id;
        this.userId = userId;
        this.walletAddress = walletAddress;
        this.challengeText = challengeText;
        this.expiresAt = expiresAt;
    }

    public UUID getId() { return id; }
    public Long getUserId() { return userId; }
    public String getWalletAddress() { return walletAddress; }
    public String getChallengeText() { return challengeText; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public LocalDateTime getConsumedAt() { return consumedAt; }
    public void consume(LocalDateTime now) { consumedAt = now; }
}
