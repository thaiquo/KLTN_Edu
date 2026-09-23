package iuh.fit.learning_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "tutor_reviews",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_tutor_reviews_student_classroom", columnNames = {"student_id", "classroom_id"})
        },
        indexes = {
                @Index(name = "idx_tutor_reviews_tutor", columnList = "tutor_id"),
                @Index(name = "idx_tutor_reviews_classroom", columnList = "classroom_id"),
                @Index(name = "idx_tutor_reviews_student", columnList = "student_id")
        }
)
public class TutorReview {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long studentId;

    @Column(nullable = false)
    private Long tutorId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private ClassRoom classRoom;

    @Column(nullable = false)
    private Integer rating;

    @Column(nullable = false, length = 1000)
    private String comment;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
