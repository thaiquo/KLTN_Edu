package iuh.fit.account_service.dto.tutor;

import iuh.fit.account_service.enums.TeachingLevel;

import java.math.BigDecimal;
import java.util.Set;

public class PublicTutorSubjectResponse {

    private final Long subjectId;
    private final String name;
    private final SubjectCategoryResponse category;
    private final SubjectGroupResponse group;
    private final Set<TeachingLevel> levels;
    private final BigDecimal oneToOneHourlyRate;
    private final Integer experienceYears;
    private final String description;

    public PublicTutorSubjectResponse(
            Long subjectId,
            String name,
            SubjectCategoryResponse category,
            SubjectGroupResponse group,
            Set<TeachingLevel> levels,
            BigDecimal oneToOneHourlyRate,
            Integer experienceYears,
            String description
    ) {
        this.subjectId = subjectId;
        this.name = name;
        this.category = category;
        this.group = group;
        this.levels = levels;
        this.oneToOneHourlyRate = oneToOneHourlyRate;
        this.experienceYears = experienceYears;
        this.description = description;
    }

    public Long getSubjectId() {
        return subjectId;
    }

    public String getName() {
        return name;
    }

    public SubjectCategoryResponse getCategory() {
        return category;
    }

    public SubjectGroupResponse getGroup() {
        return group;
    }

    public Set<TeachingLevel> getLevels() {
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
}
