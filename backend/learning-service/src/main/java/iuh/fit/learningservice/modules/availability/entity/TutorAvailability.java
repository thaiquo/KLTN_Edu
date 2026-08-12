package iuh.fit.learningservice.modules.availability.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "tutor_availabilities")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TutorAvailability {

    @Id
    private UUID id;

    @Column(name = "tutor_id", nullable = false)
    private UUID tutorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 10)
    private DayOfWeek dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AvailabilityStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public TutorAvailability(UUID tutorId, DayOfWeek dayOfWeek, LocalTime startTime,
                             LocalTime endTime, AvailabilityStatus status) {
        this.id = UUID.randomUUID();
        this.tutorId = tutorId;
        change(dayOfWeek, startTime, endTime, status);
    }

    public void change(DayOfWeek dayOfWeek, LocalTime startTime,
                       LocalTime endTime, AvailabilityStatus status) {
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
        this.status = status;
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
