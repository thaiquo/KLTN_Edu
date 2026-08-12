package iuh.fit.learningservice.modules.classroom.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "classrooms")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClassRoom {

    @Id
    private UUID id;

    @Column(name = "tutor_id", nullable = false)
    private UUID tutorId;

    @Column(name = "teaching_registration_id", nullable = false)
    private UUID teachingRegistrationId;

    @Column(name = "subject_name", nullable = false)
    private String subjectName;

    @Column(name = "teaching_level", nullable = false)
    private String teachingLevel;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "max_students", nullable = false)
    private int maxStudents;

    @Column(name = "sessions_per_week", nullable = false)
    private int sessionsPerWeek;

    @Column(name = "session_duration_minutes", nullable = false)
    private int sessionDurationMinutes;

    @Column(name = "duration_value", nullable = false)
    private int durationValue;

    @Column(name = "duration_unit", nullable = false, length = 20)
    private String durationUnit;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

    @Column(name = "price_per_session", nullable = false, precision = 12, scale = 2)
    private BigDecimal pricePerSession;

    @Column(name = "total_sessions", nullable = false)
    private int totalSessions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ClassRoomStatus status;

    @OneToMany(mappedBy = "classRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ClassSchedule> schedules = new ArrayList<>();

    @OneToMany(mappedBy = "classRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Enrollment> enrollments = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public ClassRoom(UUID tutorId, UUID teachingRegistrationId, String subjectName, String teachingLevel,
                     String name, String description, int maxStudents, int sessionsPerWeek,
                     int sessionDurationMinutes, int durationValue, String durationUnit,
                     LocalDate startDate, LocalDate endDate, BigDecimal totalPrice,
                     BigDecimal pricePerSession, int totalSessions) {
        this.id = UUID.randomUUID();
        this.tutorId = tutorId;
        this.teachingRegistrationId = teachingRegistrationId;
        this.subjectName = subjectName;
        this.teachingLevel = teachingLevel;
        this.name = name;
        this.description = description;
        this.maxStudents = maxStudents;
        this.sessionsPerWeek = sessionsPerWeek;
        this.sessionDurationMinutes = sessionDurationMinutes;
        this.durationValue = durationValue;
        this.durationUnit = durationUnit;
        this.startDate = startDate;
        this.endDate = endDate;
        this.totalPrice = totalPrice;
        this.pricePerSession = pricePerSession;
        this.totalSessions = totalSessions;
        this.status = ClassRoomStatus.PENDING_APPROVAL;
    }

    public void addSchedule(ClassSchedule schedule) {
        schedule.setClassRoom(this);
        schedules.add(schedule);
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
