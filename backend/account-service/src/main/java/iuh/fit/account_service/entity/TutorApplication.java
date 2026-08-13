package iuh.fit.account_service.entity;

import iuh.fit.account_service.enums.TutorApplicationStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "tutor_applications")
public class TutorApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TutorApplicationStatus status = TutorApplicationStatus.DRAFT;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(length = 120)
    private String educationLevel;

    @Column(length = 255)
    private String institution;

    @Column(length = 160)
    private String major;

    @Column(length = 1000)
    private String experienceSummary;

    private LocalDateTime submittedAt;

    private LocalDateTime reviewedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(length = 1000)
    private String rejectionReason;

    @Column(length = 1000)
    private String reviewNote;

    @Column(length = 100)
    private String applicantFullName;

    @Column(length = 255)
    private String applicantEmail;

    @Column(length = 20)
    private String applicantPhone;

    private LocalDate applicantDateOfBirth;

    @Column(length = 30)
    private String applicantGender;

    @Column(length = 30)
    private String applicantProvinceCode;

    @Column(length = 120)
    private String applicantProvinceName;

    @Column(length = 40)
    private String applicantCommuneCode;

    @Column(length = 160)
    private String applicantCommuneName;

    @Column(length = 255)
    private String applicantAddressDetail;

    @Column(length = 512)
    private String applicantAvatarKey;

    @OneToMany(
            mappedBy = "tutorApplication",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    private Set<TutorApplicationSubject> subjects = new LinkedHashSet<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (status == null) {
            status = TutorApplicationStatus.DRAFT;
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

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public TutorApplicationStatus getStatus() {
        return status;
    }

    public void setStatus(TutorApplicationStatus status) {
        this.status = status;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(String educationLevel) {
        this.educationLevel = educationLevel;
    }

    public String getInstitution() {
        return institution;
    }

    public void setInstitution(String institution) {
        this.institution = institution;
    }

    public String getMajor() {
        return major;
    }

    public void setMajor(String major) {
        this.major = major;
    }

    public String getExperienceSummary() {
        return experienceSummary;
    }

    public void setExperienceSummary(String experienceSummary) {
        this.experienceSummary = experienceSummary;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public User getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(User reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public String getApplicantFullName() { return applicantFullName; }
    public void setApplicantFullName(String applicantFullName) { this.applicantFullName = applicantFullName; }
    public String getApplicantEmail() { return applicantEmail; }
    public void setApplicantEmail(String applicantEmail) { this.applicantEmail = applicantEmail; }
    public String getApplicantPhone() { return applicantPhone; }
    public void setApplicantPhone(String applicantPhone) { this.applicantPhone = applicantPhone; }
    public LocalDate getApplicantDateOfBirth() { return applicantDateOfBirth; }
    public void setApplicantDateOfBirth(LocalDate applicantDateOfBirth) { this.applicantDateOfBirth = applicantDateOfBirth; }
    public String getApplicantGender() { return applicantGender; }
    public void setApplicantGender(String applicantGender) { this.applicantGender = applicantGender; }
    public String getApplicantProvinceCode() { return applicantProvinceCode; }
    public void setApplicantProvinceCode(String applicantProvinceCode) { this.applicantProvinceCode = applicantProvinceCode; }
    public String getApplicantProvinceName() { return applicantProvinceName; }
    public void setApplicantProvinceName(String applicantProvinceName) { this.applicantProvinceName = applicantProvinceName; }
    public String getApplicantCommuneCode() { return applicantCommuneCode; }
    public void setApplicantCommuneCode(String applicantCommuneCode) { this.applicantCommuneCode = applicantCommuneCode; }
    public String getApplicantCommuneName() { return applicantCommuneName; }
    public void setApplicantCommuneName(String applicantCommuneName) { this.applicantCommuneName = applicantCommuneName; }
    public String getApplicantAddressDetail() { return applicantAddressDetail; }
    public void setApplicantAddressDetail(String applicantAddressDetail) { this.applicantAddressDetail = applicantAddressDetail; }
    public String getApplicantAvatarKey() { return applicantAvatarKey; }
    public void setApplicantAvatarKey(String applicantAvatarKey) { this.applicantAvatarKey = applicantAvatarKey; }

    public Set<TutorApplicationSubject> getSubjects() {
        return subjects;
    }

    public void setSubjects(Set<TutorApplicationSubject> subjects) {
        this.subjects = subjects;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
