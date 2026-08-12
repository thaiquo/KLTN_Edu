package iuh.fit.account_service.modules.tutor.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "tutor_application_subjects")
@Getter @Setter @NoArgsConstructor
public class TeachingSubject {
    @Id @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tutor_application_id", nullable = false)
    private TutorApplication tutorApplication;

    @Column(name = "level_group", nullable = false, length = 64)
    private String levelGroup;
    @Column(name = "subject_name", nullable = false, length = 255)
    private String subjectName;
    @Column(name = "teaching_level", nullable = false, length = 128)
    private String teachingLevel;
    @Column(nullable = false, columnDefinition = "text")
    private String bio;
    @Column(nullable = false, columnDefinition = "text")
    private String experience;

    @OneToMany(mappedBy = "teachingSubject", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Certificate> certificates = new ArrayList<>();

    public void addCertificate(Certificate certificate) {
        certificate.setTeachingSubject(this);
        certificates.add(certificate);
    }
}
