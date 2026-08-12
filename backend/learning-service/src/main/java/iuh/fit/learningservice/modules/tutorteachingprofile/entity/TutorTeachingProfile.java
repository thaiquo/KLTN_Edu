package iuh.fit.learningservice.modules.tutorteachingprofile.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "tutor_teaching_profiles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TutorTeachingProfile {

    @Id
    private UUID id;

    @Column(name = "tutor_id", nullable = false, unique = true)
    private UUID tutorId;

    @Column(name = "hourly_rate", nullable = false, precision = 12, scale = 2)
    private BigDecimal hourlyRate;

    @Enumerated(EnumType.STRING)
    @Column(name = "teaching_mode", nullable = false, length = 20)
    private TeachingMode teachingMode;

    @ElementCollection
    @CollectionTable(
        name = "tutor_teaching_profile_locations",
        joinColumns = @JoinColumn(name = "tutor_teaching_profile_id")
    )
    @Column(name = "location", nullable = false)
    private Set<String> locations = new LinkedHashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TeachingProfileStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public TutorTeachingProfile(UUID tutorId, BigDecimal hourlyRate, TeachingMode teachingMode,
                                Set<String> locations, TeachingProfileStatus status) {
        this.id = UUID.randomUUID();
        this.tutorId = tutorId;
        this.hourlyRate = hourlyRate;
        this.teachingMode = teachingMode;
        this.locations = new LinkedHashSet<>(locations);
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
