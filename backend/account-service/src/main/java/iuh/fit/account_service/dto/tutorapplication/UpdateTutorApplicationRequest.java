package iuh.fit.account_service.dto.tutorapplication;

import jakarta.validation.constraints.Size;

public class UpdateTutorApplicationRequest {

    @Size(max = 3000, message = "Bio must not exceed 3000 characters")
    private String bio;

    @Size(max = 120, message = "Education level must not exceed 120 characters")
    private String educationLevel;

    @Size(max = 255, message = "Institution must not exceed 255 characters")
    private String institution;

    @Size(max = 160, message = "Major must not exceed 160 characters")
    private String major;

    @Size(max = 1000, message = "Experience summary must not exceed 1000 characters")
    private String experienceSummary;

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(String educationLevel) {
        this.educationLevel = educationLevel;
    }

    public String getInstitution() {
        return institution;
    }

    public void setInstitution(String institution) {
        this.institution = institution;
    }

    public String getMajor() {
        return major;
    }

    public void setMajor(String major) {
        this.major = major;
    }

    public String getExperienceSummary() {
        return experienceSummary;
    }

    public void setExperienceSummary(String experienceSummary) {
        this.experienceSummary = experienceSummary;
    }
}
