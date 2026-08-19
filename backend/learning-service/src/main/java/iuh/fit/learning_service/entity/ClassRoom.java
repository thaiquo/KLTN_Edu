package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.DurationUnit;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.SyllabusMode;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "class_rooms")
public class ClassRoom {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tutor_subject_registration_id", nullable = false)
    private TutorSubjectRegistration tutorSubjectRegistration;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "level_id", nullable = false)
    private CatalogLevel level;

    @Column(nullable = false, length = 255)
    private String tutorEmail;

    private Long tutorProfileId;

    @Column(length = 255)
    private String tutorFullName;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LearningMode learningMode = LearningMode.ONLINE;

    @Column(length = 500)
    private String meetingLink;

    @Column(length = 500)
    private String address;

    @Column(nullable = false)
    private Integer maxStudents = 20;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal pricePerSession;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

    @Column(nullable = false)
    private Integer sessionsPerWeek = 3;

    @Column(nullable = false)
    private Integer durationPerSessionMinutes = 90;

    @Column(nullable = false)
    private Integer durationValue = 3;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DurationUnit durationUnit = DurationUnit.MONTH;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @Column(nullable = false)
    private Integer totalSessions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SyllabusMode syllabusMode = SyllabusMode.FORM;

    @Column(length = 1000)
    private String syllabusFileUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private JoinMode joinMode = JoinMode.OPEN_REQUEST;

    @Column(length = 50)
    private String joinKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ClassRoomStatus status = ClassRoomStatus.PENDING_APPROVAL;

    @Column(columnDefinition = "TEXT")
    private String rejectReason;

    @OneToMany(mappedBy = "classRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayOfWeek ASC, startTime ASC")
    private List<ClassSchedule> schedules = new ArrayList<>();

    @OneToMany(mappedBy = "classRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC, id ASC")
    private List<ClassChapter> chapters = new ArrayList<>();

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
