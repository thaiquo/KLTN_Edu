package iuh.fit.account_service.dto.learning;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public class LearningTutorSearchDataResponse {
    private Long tutorProfileId;
    private Long userId;
    private Set<String> teachingModes;
    private List<CapabilityResponse> subjects;
    private BigDecimal startingTuition;
    private List<AvailabilitySlotResponse> availability;
    private Double averageRating;
    private Long reviewCount;
    private Long publishedClassCount;
    private LocalDateTime authorizationUpdatedAt;

    public Long getTutorProfileId() { return tutorProfileId; }
    public void setTutorProfileId(Long tutorProfileId) { this.tutorProfileId = tutorProfileId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Set<String> getTeachingModes() { return teachingModes; }
    public void setTeachingModes(Set<String> teachingModes) { this.teachingModes = teachingModes; }
    public List<CapabilityResponse> getSubjects() { return subjects; }
    public void setSubjects(List<CapabilityResponse> subjects) { this.subjects = subjects; }
    public BigDecimal getStartingTuition() { return startingTuition; }
    public void setStartingTuition(BigDecimal startingTuition) { this.startingTuition = startingTuition; }
    public List<AvailabilitySlotResponse> getAvailability() { return availability; }
    public void setAvailability(List<AvailabilitySlotResponse> availability) { this.availability = availability; }
    public Double getAverageRating() { return averageRating; }
    public void setAverageRating(Double averageRating) { this.averageRating = averageRating; }
    public Long getReviewCount() { return reviewCount; }
    public void setReviewCount(Long reviewCount) { this.reviewCount = reviewCount; }
    public Long getPublishedClassCount() { return publishedClassCount; }
    public void setPublishedClassCount(Long publishedClassCount) { this.publishedClassCount = publishedClassCount; }
    public LocalDateTime getAuthorizationUpdatedAt() { return authorizationUpdatedAt; }
    public void setAuthorizationUpdatedAt(LocalDateTime authorizationUpdatedAt) { this.authorizationUpdatedAt = authorizationUpdatedAt; }

    public static class CapabilityResponse {
        private Long registrationId;
        private Long subjectId;
        private String subjectName;
        private Long categoryId;
        private String categoryName;
        private List<LevelResponse> levels;
        private Integer experienceYears;
        private BigDecimal tuitionMin;
        private BigDecimal tuitionMax;
        private String description;

        public Long getRegistrationId() { return registrationId; }
        public void setRegistrationId(Long registrationId) { this.registrationId = registrationId; }
        public Long getSubjectId() { return subjectId; }
        public void setSubjectId(Long subjectId) { this.subjectId = subjectId; }
        public String getSubjectName() { return subjectName; }
        public void setSubjectName(String subjectName) { this.subjectName = subjectName; }
        public Long getCategoryId() { return categoryId; }
        public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
        public String getCategoryName() { return categoryName; }
        public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
        public List<LevelResponse> getLevels() { return levels; }
        public void setLevels(List<LevelResponse> levels) { this.levels = levels; }
        public Integer getExperienceYears() { return experienceYears; }
        public void setExperienceYears(Integer experienceYears) { this.experienceYears = experienceYears; }
        public BigDecimal getTuitionMin() { return tuitionMin; }
        public void setTuitionMin(BigDecimal tuitionMin) { this.tuitionMin = tuitionMin; }
        public BigDecimal getTuitionMax() { return tuitionMax; }
        public void setTuitionMax(BigDecimal tuitionMax) { this.tuitionMax = tuitionMax; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    public static class LevelResponse {
        private Long levelId;
        private String levelName;

        public Long getLevelId() { return levelId; }
        public void setLevelId(Long levelId) { this.levelId = levelId; }
        public String getLevelName() { return levelName; }
        public void setLevelName(String levelName) { this.levelName = levelName; }
    }

    public static class AvailabilitySlotResponse {
        private Long id;
        private Integer dayOfWeek;
        private String startTime;
        private String endTime;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Integer getDayOfWeek() { return dayOfWeek; }
        public void setDayOfWeek(Integer dayOfWeek) { this.dayOfWeek = dayOfWeek; }
        public String getStartTime() { return startTime; }
        public void setStartTime(String startTime) { this.startTime = startTime; }
        public String getEndTime() { return endTime; }
        public void setEndTime(String endTime) { this.endTime = endTime; }
    }
}
