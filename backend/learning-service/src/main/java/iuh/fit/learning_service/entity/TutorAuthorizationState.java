package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.TeachingMode;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

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

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "tutor_authorization_teaching_modes",
            joinColumns = @JoinColumn(name = "user_id")
    )
    @Column(name = "teaching_mode", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private Set<TeachingMode> teachingModes = new LinkedHashSet<>();

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
