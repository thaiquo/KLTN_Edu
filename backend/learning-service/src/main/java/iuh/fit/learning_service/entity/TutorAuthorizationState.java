package iuh.fit.learning_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "tutor_authorization_states")
public class TutorAuthorizationState {
    @Id
    private Long userId;

    @Column(nullable = false, length = 20)
    private String status;

    private Long tutorProfileId;

    @Column(length = 80)
    private String sourceEventId;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }
}
