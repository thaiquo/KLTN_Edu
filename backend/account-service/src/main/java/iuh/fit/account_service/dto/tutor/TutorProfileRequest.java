package iuh.fit.account_service.dto.tutor;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public class TutorProfileRequest {

    @NotBlank(message = "Bio is required")
    @Size(max = 2000, message = "Bio must not exceed 2000 characters")
    private String bio;

    @NotBlank(message = "Education is required")
    @Size(max = 500, message = "Education must not exceed 500 characters")
    private String education;

    @NotNull(message = "Experience years is required")
    @Min(value = 0, message = "Experience years must be at least 0")
    @Max(value = 60, message = "Experience years must not exceed 60")
    private Integer experienceYears;

    @NotEmpty(message = "At least one subject is required")
    private List<Long> subjectIds;

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getEducation() {
        return education;
    }

    public void setEducation(String education) {
        this.education = education;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public List<Long> getSubjectIds() {
        return subjectIds;
    }

    public void setSubjectIds(List<Long> subjectIds) {
        this.subjectIds = subjectIds;
    }
}
