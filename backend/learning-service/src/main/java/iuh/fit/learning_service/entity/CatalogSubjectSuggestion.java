package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.LevelType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "catalog_subject_suggestions")
public class CatalogSubjectSuggestion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "category_id")
    private CatalogCategory category;
    @Column(nullable = false, length = 160) private String suggestedSubjectName;
    @Column(nullable = false, length = 160) private String suggestedLevelName;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 40) private LevelType suggestedLevelType;
    @Column(length = 1000) private String note;
    @Column(nullable = false, length = 255) private String requestedByEmail;
    @Column(nullable = false, length = 20) private String status = "PENDING";
    @Column(length = 255) private String reviewedByEmail;
    private LocalDateTime reviewedAt;
    @Column(length = 1000) private String rejectReason;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "approved_subject_id") private CatalogSubject approvedSubject;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "approved_level_id") private CatalogLevel approvedLevel;
    @Column(nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); }
}
