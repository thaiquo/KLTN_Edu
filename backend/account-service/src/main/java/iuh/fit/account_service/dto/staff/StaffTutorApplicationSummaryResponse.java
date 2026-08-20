package iuh.fit.account_service.dto.staff;

import iuh.fit.account_service.enums.TutorApplicationStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class StaffTutorApplicationSummaryResponse {

    private Long applicationId;
    private Long applicantUserId;
    private String fullName;
    private String email;
    private String phone;
    private LocalDate dateOfBirth;
    private String provinceName;
    private String communeName;
    private String avatarUrl;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private String reviewedByName;
    private String reviewedByEmail;
    private String rejectionReason;
    private String reviewNote;
    private TutorApplicationStatus status;
    private long subjectCount;
    private long documentCount;
    private String educationLevel;
    private String institution;

    public StaffTutorApplicationSummaryResponse(
            Long applicationId,
            Long applicantUserId,
            String fullName,
            String email,
            String phone,
            LocalDate dateOfBirth,
            String provinceName,
            String communeName,
            String avatarUrl,
            LocalDateTime submittedAt,
            LocalDateTime reviewedAt,
            String reviewedByName,
            String reviewedByEmail,
            String rejectionReason,
            String reviewNote,
            TutorApplicationStatus status,
            long subjectCount,
            long documentCount,
            String educationLevel,
            String institution
    ) {
        this.applicationId = applicationId;
        this.applicantUserId = applicantUserId;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.dateOfBirth = dateOfBirth;
        this.provinceName = provinceName;
        this.communeName = communeName;
        this.avatarUrl = avatarUrl;
        this.submittedAt = submittedAt;
        this.reviewedAt = reviewedAt;
        this.reviewedByName = reviewedByName;
        this.reviewedByEmail = reviewedByEmail;
        this.rejectionReason = rejectionReason;
        this.reviewNote = reviewNote;
        this.status = status;
        this.subjectCount = subjectCount;
        this.documentCount = documentCount;
        this.educationLevel = educationLevel;
        this.institution = institution;
    }

    public Long getApplicationId() { return applicationId; }
    public Long getApplicantUserId() { return applicantUserId; }
    public String getFullName() { return fullName; }
    public String getApplicantFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getApplicantEmail() { return email; }
    public String getPhone() { return phone; }
    public String getApplicantPhone() { return phone; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public LocalDate getApplicantDateOfBirth() { return dateOfBirth; }
    public String getProvinceName() { return provinceName; }
    public String getApplicantProvinceName() { return provinceName; }
    public String getCommuneName() { return communeName; }
    public String getApplicantCommuneName() { return communeName; }
    public String getAvatarUrl() { return avatarUrl; }
    public String getApplicantAvatarUrl() { return avatarUrl; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public String getReviewedByName() { return reviewedByName; }
    public String getReviewedByEmail() { return reviewedByEmail; }
    public String getRejectionReason() { return rejectionReason; }
    public String getReviewNote() { return reviewNote; }
    public TutorApplicationStatus getStatus() { return status; }
    public long getSubjectCount() { return subjectCount; }
    public long getDocumentCount() { return documentCount; }
    public String getEducationLevel() { return educationLevel; }
    public String getInstitution() { return institution; }
}
