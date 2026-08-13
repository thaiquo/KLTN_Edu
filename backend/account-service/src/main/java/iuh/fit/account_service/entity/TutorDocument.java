package iuh.fit.account_service.entity;

import iuh.fit.account_service.enums.CredentialValidityType;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorDocumentVerificationStatus;
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
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "tutor_documents")
public class TutorDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tutor_application_id", nullable = false)
    private TutorApplication tutorApplication;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TutorDocumentType documentType;

    @Column(nullable = false, unique = true, length = 500)
    private String fileKey;

    @Column(nullable = false, length = 255)
    private String originalFilename;

    @Column(nullable = false, length = 120)
    private String contentType;

    @Column(nullable = false)
    private Long fileSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TutorDocumentVerificationStatus verificationStatus = TutorDocumentVerificationStatus.PENDING;

    @Column(nullable = false)
    private LocalDateTime uploadedAt;

    @Column(length = 160)
    private String title;

    @Column(length = 160)
    private String issuer;

    private LocalDate issueDate;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private CredentialValidityType validityType;

    private LocalDate expiryDate;

    @Column(length = 120)
    private String credentialNumber;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (verificationStatus == null) {
            verificationStatus = TutorDocumentVerificationStatus.PENDING;
        }
        if (uploadedAt == null) {
            uploadedAt = now;
        }
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public TutorApplication getTutorApplication() { return tutorApplication; }
    public void setTutorApplication(TutorApplication tutorApplication) { this.tutorApplication = tutorApplication; }
    public TutorDocumentType getDocumentType() { return documentType; }
    public void setDocumentType(TutorDocumentType documentType) { this.documentType = documentType; }
    public String getFileKey() { return fileKey; }
    public void setFileKey(String fileKey) { this.fileKey = fileKey; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public TutorDocumentVerificationStatus getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(TutorDocumentVerificationStatus verificationStatus) { this.verificationStatus = verificationStatus; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getIssuer() { return issuer; }
    public void setIssuer(String issuer) { this.issuer = issuer; }
    public LocalDate getIssueDate() { return issueDate; }
    public void setIssueDate(LocalDate issueDate) { this.issueDate = issueDate; }
    public CredentialValidityType getValidityType() { return validityType; }
    public void setValidityType(CredentialValidityType validityType) { this.validityType = validityType; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public String getCredentialNumber() { return credentialNumber; }
    public void setCredentialNumber(String credentialNumber) { this.credentialNumber = credentialNumber; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
