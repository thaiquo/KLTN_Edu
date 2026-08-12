package iuh.fit.account_service.modules.tutor.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tutor_application_events")
@Getter @Setter @NoArgsConstructor
public class TutorApplicationEvent {
    @Id @GeneratedValue private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tutor_application_id", nullable = false)
    private TutorApplication tutorApplication;
    @Column(name = "actor_id") private UUID actorId;
    @Column(name = "event_type", nullable = false, length = 64) private String eventType;
    @Column(length = 1000) private String detail;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
