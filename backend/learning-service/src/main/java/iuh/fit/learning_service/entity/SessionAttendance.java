package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.AttendanceOutcome;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "session_attendances", uniqueConstraints = {
        @UniqueConstraint(name = "uq_session_student_att", columnNames = {"session_id", "student_id"})
})
public class SessionAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private ClassSession session;

    @Column(nullable = false)
    private Long studentId;

    @Column(length = 255)
    private String studentEmail;

    @Column(length = 255)
    private String studentName;

    @Column(nullable = false)
    private Long tutorId;

    @Column(nullable = false)
    private Boolean tutorChecked = false;

    private LocalDateTime tutorCheckedAt;

    @Column(nullable = false)
    private Boolean studentChecked = false;

    private LocalDateTime studentCheckedAt;

    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    private AttendanceOutcome finalOutcome;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
