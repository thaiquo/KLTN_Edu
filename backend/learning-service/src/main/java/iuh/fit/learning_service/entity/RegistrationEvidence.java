package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.EvidenceType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "registration_evidence")
public class RegistrationEvidence {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "registration_id", nullable = false)
    private TutorSubjectRegistration registration;

    private Long accountDocumentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private EvidenceType evidenceType;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(length = 1000)
    private String fileUrl;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
