package iuh.fit.learningservice.modules.availability.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tutor_availability_usages")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TutorAvailabilityUsage {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "availability_id", nullable = false)
    private TutorAvailability availability;

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false, length = 20)
    private AvailabilityResourceType resourceType;

    @Column(name = "resource_id", nullable = false)
    private UUID resourceId;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public TutorAvailabilityUsage(TutorAvailability availability, AvailabilityResourceType resourceType,
                                   UUID resourceId) {
        this.id = UUID.randomUUID();
        this.availability = availability;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.active = true;
    }

    public void release() {
        active = false;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
