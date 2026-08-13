package iuh.fit.account_service.entity;

import iuh.fit.account_service.enums.SubjectSuggestionStatus;
import iuh.fit.account_service.enums.TeachingLevel;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
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
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "subject_suggestions")
public class SubjectSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "suggested_by", nullable = false)
    private User suggestedBy;

    @Column(nullable = false, length = 160)
    private String suggestedName;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private SubjectCategory category;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private SubjectGroup group;

    @Column(length = 1000)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubjectSuggestionStatus status = SubjectSuggestionStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    private LocalDateTime reviewedAt;

    @Column(length = 1000)
    private String rejectionReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_subject_id")
    private Subject approvedSubject;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "subject_suggestion_levels",
            joinColumns = @JoinColumn(name = "subject_suggestion_id")
    )
    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 40)
    private Set<TeachingLevel> levels = new LinkedHashSet<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public User getSuggestedBy() { return suggestedBy; }
    public void setSuggestedBy(User suggestedBy) { this.suggestedBy = suggestedBy; }
    public String getSuggestedName() { return suggestedName; }
    public void setSuggestedName(String suggestedName) { this.suggestedName = suggestedName; }
    public SubjectCategory getCategory() { return category; }
    public void setCategory(SubjectCategory category) { this.category = category; }
    public SubjectGroup getGroup() { return group; }
    public void setGroup(SubjectGroup group) { this.group = group; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public SubjectSuggestionStatus getStatus() { return status; }
    public void setStatus(SubjectSuggestionStatus status) { this.status = status; }
    public User getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(User reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public Subject getApprovedSubject() { return approvedSubject; }
    public void setApprovedSubject(Subject approvedSubject) { this.approvedSubject = approvedSubject; }
    public Set<TeachingLevel> getLevels() { return levels; }
    public void setLevels(Set<TeachingLevel> levels) { this.levels = levels == null ? new LinkedHashSet<>() : levels; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
