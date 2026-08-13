package iuh.fit.account_service.dto.subjectsuggestion;

import iuh.fit.account_service.dto.tutor.SubjectCategoryResponse;
import iuh.fit.account_service.dto.tutor.SubjectGroupResponse;
import iuh.fit.account_service.dto.tutor.SubjectResponse;
import iuh.fit.account_service.enums.SubjectSuggestionStatus;
import iuh.fit.account_service.enums.TeachingLevel;

import java.time.LocalDateTime;
import java.util.Set;

public class SubjectSuggestionResponse {

    private Long id;
    private String suggestedName;
    private SubjectCategoryResponse category;
    private SubjectGroupResponse group;
    private Set<TeachingLevel> levels;
    private String note;
    private SubjectSuggestionStatus status;
    private SubjectResponse approvedSubject;
    private String reviewerName;
    private LocalDateTime reviewedAt;
    private String rejectionReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public SubjectSuggestionResponse(
            Long id,
            String suggestedName,
            SubjectCategoryResponse category,
            SubjectGroupResponse group,
            Set<TeachingLevel> levels,
            String note,
            SubjectSuggestionStatus status,
            SubjectResponse approvedSubject,
            String reviewerName,
            LocalDateTime reviewedAt,
            String rejectionReason,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this.id = id;
        this.suggestedName = suggestedName;
        this.category = category;
        this.group = group;
        this.levels = levels;
        this.note = note;
        this.status = status;
        this.approvedSubject = approvedSubject;
        this.reviewerName = reviewerName;
        this.reviewedAt = reviewedAt;
        this.rejectionReason = rejectionReason;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() { return id; }
    public String getSuggestedName() { return suggestedName; }
    public SubjectCategoryResponse getCategory() { return category; }
    public SubjectGroupResponse getGroup() { return group; }
    public Set<TeachingLevel> getLevels() { return levels; }
    public String getNote() { return note; }
    public SubjectSuggestionStatus getStatus() { return status; }
    public SubjectResponse getApprovedSubject() { return approvedSubject; }
    public String getReviewerName() { return reviewerName; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public String getRejectionReason() { return rejectionReason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
