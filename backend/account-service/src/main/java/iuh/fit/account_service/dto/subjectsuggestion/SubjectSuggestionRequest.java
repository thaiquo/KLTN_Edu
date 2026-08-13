package iuh.fit.account_service.dto.subjectsuggestion;

import iuh.fit.account_service.enums.TeachingLevel;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashSet;
import java.util.Set;

public class SubjectSuggestionRequest {

    @NotNull(message = "Suggested subject name is required")
    @Size(min = 2, max = 160, message = "Suggested subject name must be between 2 and 160 characters")
    private String suggestedName;

    @NotNull(message = "Category is required")
    private Long categoryId;

    @NotNull(message = "Subject group is required")
    private Long groupId;

    @NotEmpty(message = "At least one teaching level is required")
    private Set<TeachingLevel> levels = new LinkedHashSet<>();

    @Size(max = 1000, message = "Note must not exceed 1000 characters")
    private String note;

    public String getSuggestedName() { return suggestedName; }
    public void setSuggestedName(String suggestedName) { this.suggestedName = suggestedName; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }
    public Set<TeachingLevel> getLevels() { return levels; }
    public void setLevels(Set<TeachingLevel> levels) { this.levels = levels == null ? new LinkedHashSet<>() : levels; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
