package iuh.fit.account_service.dto.tutorapplication;

import iuh.fit.account_service.enums.TeachingMode;
import iuh.fit.account_service.enums.TutorApplicationStatus;

import java.time.LocalDateTime;
import java.util.Set;

public class TutorApplicationResponse {

    private Long id;
    private TutorApplicationStatus status;
    private String bio;
    private String educationLevel;
    private String institution;
    private String major;
    private String experienceSummary;
    private Set<TeachingMode> teachingModes;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private String rejectionReason;
    private String reviewNote;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public TutorApplicationResponse(
            Long id,
            TutorApplicationStatus status,
            String bio,
            String educationLevel,
            String institution,
            String major,
            String experienceSummary,
            Set<TeachingMode> teachingModes,
            LocalDateTime submittedAt,
            LocalDateTime reviewedAt,
            String rejectionReason,
            String reviewNote,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this.id = id;
        this.status = status;
        this.bio = bio;
        this.educationLevel = educationLevel;
        this.institution = institution;
        this.major = major;
        this.experienceSummary = experienceSummary;
        this.teachingModes = teachingModes;
        this.submittedAt = submittedAt;
        this.reviewedAt = reviewedAt;
        this.rejectionReason = rejectionReason;
        this.reviewNote = reviewNote;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public TutorApplicationStatus getStatus() {
        return status;
    }

    public String getBio() {
        return bio;
    }

    public String getEducationLevel() {
        return educationLevel;
    }

    public String getInstitution() {
        return institution;
    }

    public String getMajor() {
        return major;
    }

    public String getExperienceSummary() {
        return experienceSummary;
    }

    public Set<TeachingMode> getTeachingModes() {
        return teachingModes;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
