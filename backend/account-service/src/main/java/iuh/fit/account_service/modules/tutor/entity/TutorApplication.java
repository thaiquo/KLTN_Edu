package iuh.fit.account_service.modules.tutor.entity;

import iuh.fit.account_service.modules.auth.entity.Account;
import iuh.fit.account_service.modules.tutor.enums.TutorApplicationStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "tutor_applications")
@Getter
@Setter
@NoArgsConstructor
public class TutorApplication {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private Account user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TutorApplicationStatus status = TutorApplicationStatus.DRAFT;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;

    @Column(name = "review_note", length = 1000)
    private String reviewNote;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "tutorApplication", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Certificate> certificates = new ArrayList<>();

    @OneToMany(mappedBy = "tutorApplication", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TeachingSubject> teachingSubjects = new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public void replaceCertificates(List<Certificate> replacements) {
        certificates.clear();
        replacements.forEach(this::addCertificate);
    }

    public void addCertificate(Certificate certificate) {
        certificate.setTutorApplication(this);
        certificates.add(certificate);
    }

    public void replaceTeachingSubjects(List<TeachingSubject> replacements) {
        teachingSubjects.clear();
        replacements.forEach(subject -> {
            subject.setTutorApplication(this);
            subject.getCertificates().forEach(certificate -> certificate.setTutorApplication(this));
            teachingSubjects.add(subject);
        });
    }
}
