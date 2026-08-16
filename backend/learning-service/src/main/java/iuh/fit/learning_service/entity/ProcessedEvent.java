package iuh.fit.learning_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "processed_events")
public class ProcessedEvent {
    @Id
    @Column(length = 80)
    private String eventId;

    @Column(nullable = false, length = 120)
    private String eventType;

    @Column(nullable = false)
    private LocalDateTime processedAt = LocalDateTime.now();
}
