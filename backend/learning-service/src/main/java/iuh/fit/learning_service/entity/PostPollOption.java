package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.PollTimePeriod;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "post_poll_options")
public class PostPollOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poll_id", nullable = false)
    private PostPoll poll;

    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek; // 1 = Monday, 7 = Sunday

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "time_period", nullable = false, length = 20)
    private PollTimePeriod timePeriod;

    @Column(name = "option_label", nullable = false, length = 150)
    private String optionLabel;

    @Column(name = "vote_count", nullable = false)
    private Integer voteCount = 0;

    @PrePersist
    public void prePersist() {
        if (voteCount == null) voteCount = 0;
        if (timePeriod == null) timePeriod = PollTimePeriod.fromStartTime(startTime);
    }
}
