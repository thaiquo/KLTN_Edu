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
@Table(
        name = "tutor_follows",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_student_tutor_follow", columnNames = {"student_user_id", "tutor_user_id"})
        }
)
public class TutorFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_user_id", nullable = false)
    private Long studentUserId;

    @Column(name = "tutor_user_id", nullable = false)
    private Long tutorUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public TutorFollow(Long studentUserId, Long tutorUserId) {
        this.studentUserId = studentUserId;
        this.tutorUserId = tutorUserId;
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
