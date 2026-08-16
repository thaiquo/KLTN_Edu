package iuh.fit.account_service.dto.learning;

import java.math.BigDecimal;
import java.util.Set;

public class LearningTutorSubjectResponse {
    private Long tutorProfileId;
    private Long subjectId;
    private String subjectName;
    private String subjectCategoryName;
    private String subjectGroupName;
    private Set<String> levels;
    private BigDecimal oneToOneHourlyRate;
    private Integer experienceYears;
    private String description;

    public Long getTutorProfileId() { return tutorProfileId; }
    public void setTutorProfileId(Long tutorProfileId) { this.tutorProfileId = tutorProfileId; }
    public Long getSubjectId() { return subjectId; }
    public void setSubjectId(Long subjectId) { this.subjectId = subjectId; }
    public String getSubjectName() { return subjectName; }
    public void setSubjectName(String subjectName) { this.subjectName = subjectName; }
    public String getSubjectCategoryName() { return subjectCategoryName; }
    public void setSubjectCategoryName(String subjectCategoryName) { this.subjectCategoryName = subjectCategoryName; }
    public String getSubjectGroupName() { return subjectGroupName; }
    public void setSubjectGroupName(String subjectGroupName) { this.subjectGroupName = subjectGroupName; }
    public Set<String> getLevels() { return levels; }
    public void setLevels(Set<String> levels) { this.levels = levels; }
    public BigDecimal getOneToOneHourlyRate() { return oneToOneHourlyRate; }
    public void setOneToOneHourlyRate(BigDecimal oneToOneHourlyRate) { this.oneToOneHourlyRate = oneToOneHourlyRate; }
    public Integer getExperienceYears() { return experienceYears; }
    public void setExperienceYears(Integer experienceYears) { this.experienceYears = experienceYears; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
