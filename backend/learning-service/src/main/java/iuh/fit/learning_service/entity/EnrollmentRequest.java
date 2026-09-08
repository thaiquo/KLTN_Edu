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

    @Column(name = "student_id")
    private Long studentId;

    @Column(length = 255)
    private String studentName;

    @Column(name = "student_phone", length = 50)
    private String studentPhone;

    @Column(name = "student_wallet", length = 42)
    private String studentWallet;

    @Column(name = "agreement_id", length = 36)
    private String agreementId;

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
