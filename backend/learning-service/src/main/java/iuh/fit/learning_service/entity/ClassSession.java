package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.ClassSessionStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "class_sessions", uniqueConstraints = {
        @UniqueConstraint(name = "uq_class_session_sequence", columnNames = {"class_room_id", "sequence_number"})
})
public class ClassSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_room_id", nullable = false)
    private ClassRoom classRoom;

    @Column(nullable = false)
    private Integer sequenceNumber;

    @Column(length = 255)
    private String topic;

    @Column(nullable = false)
    private LocalDate sessionDate;

    @Column(nullable = false, length = 5)
    private String startTime;

    @Column(nullable = false, length = 5)
    private String endTime;

    @Column(length = 255)
    private String assignmentTitle;

    @Column(columnDefinition = "TEXT")
    private String assignmentDescription;

    @Column(length = 1000)
    private String assignmentFileUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ClassSessionStatus status = ClassSessionStatus.SCHEDULED;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SessionAttendance> attendances = new ArrayList<>();

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
