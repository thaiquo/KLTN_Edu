package iuh.fit.account_service.entity;

import iuh.fit.account_service.enums.TeachingLevel;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(
        name = "tutor_application_subjects",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"tutor_application_id", "subject_id"})
        }
)
public class TutorApplicationSubject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tutor_application_id", nullable = false)
    private TutorApplication tutorApplication;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @DecimalMin(value = "0.01", message = "One-to-one hourly rate must be greater than 0")
    @Column(name = "one_to_one_hourly_rate", nullable = false, precision = 12, scale = 2)
    private BigDecimal oneToOneHourlyRate;

    @Min(value = 0, message = "Experience years must be at least 0")
    @Max(value = 60, message = "Experience years must not exceed 60")
    @Column(nullable = false)
    private Integer experienceYears = 0;

    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    @Column(length = 1000)
    private String description;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "tutor_application_subject_levels",
            joinColumns = @JoinColumn(name = "tutor_application_subject_id")
    )
    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 40)
    private Set<TeachingLevel> levels = new LinkedHashSet<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (experienceYears == null) {
            experienceYears = 0;
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public TutorApplication getTutorApplication() {
        return tutorApplication;
    }

    public void setTutorApplication(TutorApplication tutorApplication) {
        this.tutorApplication = tutorApplication;
    }

    public Subject getSubject() {
        return subject;
    }

    public void setSubject(Subject subject) {
        this.subject = subject;
    }

    public BigDecimal getOneToOneHourlyRate() {
        return oneToOneHourlyRate;
    }

    public void setOneToOneHourlyRate(BigDecimal oneToOneHourlyRate) {
        this.oneToOneHourlyRate = oneToOneHourlyRate;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Set<TeachingLevel> getLevels() {
        return levels;
    }

    public void setLevels(Set<TeachingLevel> levels) {
        this.levels = levels == null ? new LinkedHashSet<>() : levels;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
