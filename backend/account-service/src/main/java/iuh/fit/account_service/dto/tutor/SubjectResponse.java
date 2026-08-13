package iuh.fit.account_service.dto.tutor;

import iuh.fit.account_service.enums.TeachingLevel;

import java.util.Set;

public class SubjectResponse {

    private Long id;
    private String name;
    private SubjectCategoryResponse category;
    private SubjectGroupResponse group;
    private Set<TeachingLevel> supportedLevels;

    public SubjectResponse(Long id, String name, SubjectCategoryResponse category, Set<TeachingLevel> supportedLevels) {
        this(id, name, category, null, supportedLevels);
    }

    public SubjectResponse(Long id, String name, SubjectCategoryResponse category, SubjectGroupResponse group, Set<TeachingLevel> supportedLevels) {
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

    public SubjectCategoryResponse getCategory() {
        return category;
    }

    public SubjectGroupResponse getGroup() {
        return group;
    }

    public Set<TeachingLevel> getSupportedLevels() {
        return supportedLevels;
    }
}
