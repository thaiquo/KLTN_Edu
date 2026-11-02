package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.ClassSessionStatus;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

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

    private LocalDateTime assignmentDueAt;

    @Column(nullable = false)
    private boolean submissionRequired = false;

    @Column(nullable = false)
    private boolean lateSubmissionAllowed = true;

    @Column(length = 1000)
    private String materialUrl;

    @Column(columnDefinition = "TEXT")
    private String materialDescription;

    @Column(length = 1000)
    private String assignmentExternalUrl;

    @Column(length = 1000)
    private String materialExternalUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ClassSessionStatus status = ClassSessionStatus.SCHEDULED;

    @Column(nullable = false)
    private boolean settlementDispatched = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;

    private java.time.OffsetDateTime attendanceFinalizedAt;

    @Setter(AccessLevel.NONE)
    private Integer governanceNextSessionSequence;

    @Setter(AccessLevel.NONE)
    private java.time.OffsetDateTime governanceNextSessionStartAt;

    @Setter(AccessLevel.NONE)
    private java.time.OffsetDateTime governanceSnapshotCapturedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SessionFile> sessionFiles = new ArrayList<>();

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

    public void captureGovernanceSnapshot(
            java.time.OffsetDateTime capturedAt,
            Integer nextSessionSequence,
            java.time.OffsetDateTime nextSessionStartAt
    ) {
        Objects.requireNonNull(capturedAt, "Governance snapshot capture time is required");
        if (governanceSnapshotCapturedAt != null) {
            throw new IllegalStateException("Governance snapshot has already been captured");
        }
        if (attendanceFinalizedAt == null) {
            throw new IllegalStateException("Attendance must be finalized before capturing governance snapshot");
        }
        if ((nextSessionSequence == null) != (nextSessionStartAt == null)) {
            throw new IllegalArgumentException("Next-session sequence and start time must be supplied together");
        }
        if (nextSessionSequence != null) {
            if (sequenceNumber == null || nextSessionSequence <= sequenceNumber) {
                throw new IllegalArgumentException("Governance next-session sequence must follow the current session");
            }
            if (!nextSessionStartAt.isAfter(attendanceFinalizedAt)) {
                throw new IllegalArgumentException("Governance next-session start must be after attendance finalization");
            }
        }

        governanceNextSessionSequence = nextSessionSequence;
        governanceNextSessionStartAt = nextSessionStartAt;
        governanceSnapshotCapturedAt = capturedAt;
    }
}
