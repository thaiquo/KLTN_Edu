package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "enrollment_requests")
public class EnrollmentRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_room_id", nullable = false)
    private ClassRoom classRoom;

    @Column(nullable = false, length = 255)
    private String studentEmail;

    @Column(length = 255)
    private String studentName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EnrollmentRequestStatus status = EnrollmentRequestStatus.PENDING;

    @Column(length = 50)
    private String joinKey;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(columnDefinition = "TEXT")
    private String rejectReason;

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
