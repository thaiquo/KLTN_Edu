package iuh.fit.account_service.dto.tutorapplication;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;

public class TutorApplicationSubjectRequest {

    @NotNull(message = "Subject is required")
    private Long subjectId;

    @NotEmpty(message = "At least one teaching level is required")
    private Set<String> levels = new LinkedHashSet<>();

    @NotNull(message = "One-to-one hourly rate is required")
    @DecimalMin(value = "0.01", message = "One-to-one hourly rate must be greater than 0")
    private BigDecimal oneToOneHourlyRate;

    @NotNull(message = "Experience years is required")
    @Min(value = 0, message = "Experience years must be at least 0")
    @Max(value = 60, message = "Experience years must not exceed 60")
    private Integer experienceYears;

    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    private String description;

    public Long getSubjectId() {
        return subjectId;
    }

    public void setSubjectId(Long subjectId) {
        this.subjectId = subjectId;
    }

    public Set<String> getLevels() {
        return levels;
    }

    public void setLevels(Set<String> levels) {
        this.levels = levels == null ? new LinkedHashSet<>() : levels;
    }

    public BigDecimal getOneToOneHourlyRate() {
        return oneToOneHourlyRate;
    }

    public void setOneToOneHourlyRate(BigDecimal oneToOneHourlyRate) {
        this.oneToOneHourlyRate = oneToOneHourlyRate;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
