package iuh.fit.account_service.dto.tutor;

import iuh.fit.account_service.enums.TutorStatus;

import java.time.LocalDateTime;
import java.util.List;

public class TutorResponse {

    private Long id;
    private Long userId;
    private String fullName;
    private String email;
    private String bio;
    private String education;
    private Integer experienceYears;
    private TutorStatus status;
    private String rejectionReason;
    private List<SubjectSummaryResponse> subjects;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public TutorResponse(
            Long id,
            Long userId,
            String fullName,
            String email,
            String bio,
            String education,
            Integer experienceYears,
            TutorStatus status,
            String rejectionReason,
            List<SubjectSummaryResponse> subjects,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this.id = id;
        this.userId = userId;
        this.fullName = fullName;
        this.email = email;
        this.bio = bio;
        this.education = education;
        this.experienceYears = experienceYears;
        this.status = status;
        this.rejectionReason = rejectionReason;
        this.subjects = subjects;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getBio() {
        return bio;
    }

    public String getEducation() {
        return education;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public TutorStatus getStatus() {
        return status;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public List<SubjectSummaryResponse> getSubjects() {
        return subjects;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
