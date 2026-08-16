package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.SubjectRequestStatus;
import iuh.fit.learning_service.enums.TeachingLevel;
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
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "subject_requests")
public class SubjectRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 160)
    private String requestedName;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private SubjectCategory category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private SubjectGroup group;

    @Column(nullable = false)
    private Long requestedByUserId;

    @Column(length = 1000)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubjectRequestStatus status = SubjectRequestStatus.PENDING;

    private Long reviewedByUserId;
    private LocalDateTime reviewedAt;

    @Column(length = 1000)
    private String rejectReason;

    private Long approvedSubjectId;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "subject_request_levels", joinColumns = @JoinColumn(name = "subject_request_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 40)
    private Set<TeachingLevel> levels = new LinkedHashSet<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
