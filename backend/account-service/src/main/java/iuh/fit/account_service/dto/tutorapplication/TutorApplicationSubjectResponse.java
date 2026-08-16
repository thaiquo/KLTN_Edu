package iuh.fit.account_service.dto.tutorapplication;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

public class TutorApplicationSubjectResponse {

    private Long id;
    private SubjectSummary subject;
    private Set<String> levels;
    private BigDecimal oneToOneHourlyRate;
    private Integer experienceYears;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public TutorApplicationSubjectResponse(
            Long id,
            SubjectSummary subject,
            Set<String> levels,
            BigDecimal oneToOneHourlyRate,
            Integer experienceYears,
            String description,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this.id = id;
        this.subject = subject;
        this.levels = levels;
        this.oneToOneHourlyRate = oneToOneHourlyRate;
        this.experienceYears = experienceYears;
        this.description = description;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public SubjectSummary getSubject() {
        return subject;
    }

    public Set<String> getLevels() {
        return levels;
    }

    public BigDecimal getOneToOneHourlyRate() {
        return oneToOneHourlyRate;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public String getDescription() {
        return description;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public static class SubjectSummary {

        private Long id;
        private String name;
        private String category;
        private String group;
        private Set<String> supportedLevels;

        public SubjectSummary(Long id, String name, String category, Set<String> supportedLevels) {
            this(id, name, category, null, supportedLevels);
        }

        public SubjectSummary(Long id, String name, String category, String group, Set<String> supportedLevels) {
            this.id = id;
            this.name = name;
            this.category = category;
            this.group = group;
            this.supportedLevels = supportedLevels;
        }

        public Long getId() {
            return id;
        }

        public String getName() {
            return name;
        }

        public String getCategory() {
            return category;
        }

        public String getGroup() {
            return group;
        }

        public Set<String> getSupportedLevels() {
            return supportedLevels;
        }
    }
}
