package iuh.fit.account_service.dto.tutorapplication;

import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorDocumentVerificationStatus;
import iuh.fit.account_service.enums.CredentialValidityType;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class TutorDocumentResponse {

    private Long id;
    private TutorDocumentType documentType;
    private String originalFilename;
    private String contentType;
    private Long fileSize;
    private TutorDocumentVerificationStatus verificationStatus;
    private LocalDateTime uploadedAt;
    private String title;
    private String issuer;
    private LocalDate issueDate;
    private CredentialValidityType validityType;
    private LocalDate expiryDate;
    private String credentialNumber;
    private boolean expired;

    public TutorDocumentResponse(
            Long id,
            TutorDocumentType documentType,
            String originalFilename,
            String contentType,
            Long fileSize,
            TutorDocumentVerificationStatus verificationStatus,
            LocalDateTime uploadedAt
    ) {
        this(id, documentType, originalFilename, contentType, fileSize, verificationStatus, uploadedAt,
                null, null, null, null, null, null, false);
    }

    public TutorDocumentResponse(
            Long id,
            TutorDocumentType documentType,
            String originalFilename,
            String contentType,
            Long fileSize,
            TutorDocumentVerificationStatus verificationStatus,
            LocalDateTime uploadedAt,
            String title,
            String issuer,
            LocalDate issueDate,
            CredentialValidityType validityType,
            LocalDate expiryDate,
            String credentialNumber,
            boolean expired
    ) {
        this.id = id;
        this.documentType = documentType;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.verificationStatus = verificationStatus;
        this.uploadedAt = uploadedAt;
        this.title = title;
        this.issuer = issuer;
        this.issueDate = issueDate;
        this.validityType = validityType;
        this.expiryDate = expiryDate;
        this.credentialNumber = credentialNumber;
        this.expired = expired;
    }

    public Long getId() { return id; }
    public TutorDocumentType getDocumentType() { return documentType; }
    public String getOriginalFilename() { return originalFilename; }
    public String getContentType() { return contentType; }
    public Long getFileSize() { return fileSize; }
    public TutorDocumentVerificationStatus getVerificationStatus() { return verificationStatus; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public String getTitle() { return title; }
    public String getIssuer() { return issuer; }
    public LocalDate getIssueDate() { return issueDate; }
    public CredentialValidityType getValidityType() { return validityType; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public String getCredentialNumber() { return credentialNumber; }
    public boolean isExpired() { return expired; }
}
