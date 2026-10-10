package iuh.fit.learning_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "post_poll_votes", uniqueConstraints = {
        @UniqueConstraint(name = "uq_user_poll_option_vote", columnNames = {"poll_id", "user_id", "option_id"})
})
public class PostPollVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poll_id", nullable = false)
    private PostPoll poll;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "option_id", nullable = false)
    private PostPollOption option;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "user_name", nullable = false, length = 100)
    private String userName;

    @Column(name = "voted_at", nullable = false, updatable = false)
    private LocalDateTime votedAt = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        if (votedAt == null) votedAt = LocalDateTime.now();
    }
}
