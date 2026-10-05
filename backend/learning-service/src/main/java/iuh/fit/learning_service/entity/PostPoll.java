package iuh.fit.learning_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "post_polls")
public class PostPoll {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false, unique = true)
    private CommunityPost post;

    @Column(nullable = false, length = 255)
    private String question;

    @Column(name = "min_votes_target", nullable = false)
    private Integer minVotesTarget = 5;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "is_closed", nullable = false)
    private Boolean isClosed = false;

    @Column(name = "total_votes", nullable = false)
    private Integer totalVotes = 0;

    @OneToMany(mappedBy = "poll", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<PostPollOption> options = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (minVotesTarget == null) minVotesTarget = 5;
        if (isClosed == null) isClosed = false;
        if (totalVotes == null) totalVotes = 0;
    }
}
