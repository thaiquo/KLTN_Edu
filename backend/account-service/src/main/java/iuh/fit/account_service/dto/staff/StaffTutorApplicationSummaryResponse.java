package iuh.fit.account_service.dto.staff;

import iuh.fit.account_service.enums.TutorApplicationStatus;

import java.time.LocalDateTime;

public class StaffTutorApplicationSummaryResponse {

    private Long applicationId;
    private Long applicantUserId;
    private String fullName;
    private String email;
    private LocalDateTime submittedAt;
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
            LocalDateTime submittedAt,
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
        this.submittedAt = submittedAt;
        this.status = status;
        this.subjectCount = subjectCount;
        this.documentCount = documentCount;
        this.educationLevel = educationLevel;
        this.institution = institution;
    }

    public Long getApplicationId() { return applicationId; }
    public Long getApplicantUserId() { return applicantUserId; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public TutorApplicationStatus getStatus() { return status; }
    public long getSubjectCount() { return subjectCount; }
    public long getDocumentCount() { return documentCount; }
    public String getEducationLevel() { return educationLevel; }
    public String getInstitution() { return institution; }
}
