package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "tutor_subject_registrations")
public class TutorSubjectRegistration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String tutorEmail;
    private Long tutorProfileId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_type_id", nullable = false)
    private ProgramType programType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private CatalogCategory category;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private CatalogSubject subject;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "tutor_subject_registration_levels",
            joinColumns = @JoinColumn(name = "registration_id"),
            inverseJoinColumns = @JoinColumn(name = "level_id")
    )
    @OrderBy("orderIndex ASC, name ASC")
    private List<CatalogLevel> levels = new ArrayList<>();

    @Column(nullable = false)
    private Integer experienceYears;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal tuitionMin;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal tuitionMax;

    @Column(nullable = false, length = 1500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TutorSubjectRegistrationStatus status = TutorSubjectRegistrationStatus.PENDING;

    @Column(length = 1000)
    private String rejectReason;
    @Column(length = 1000)
    private String reviewNote;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    @Column(length = 255)
    private String reviewedByEmail;
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "registration", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RegistrationEvidence> evidence = new ArrayList<>();

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        submittedAt = submittedAt == null ? now : submittedAt;
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
