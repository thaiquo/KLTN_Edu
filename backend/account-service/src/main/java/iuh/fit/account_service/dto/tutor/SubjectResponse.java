package iuh.fit.account_service.dto.tutor;

import java.util.Set;

public class SubjectResponse {

    private Long id;
    private String name;
    private SubjectCategoryResponse category;
    private SubjectGroupResponse group;
    private Set<String> supportedLevels;

    public SubjectResponse(Long id, String name, SubjectCategoryResponse category, Set<String> supportedLevels) {
        this(id, name, category, null, supportedLevels);
    }

    public SubjectResponse(Long id, String name, SubjectCategoryResponse category, SubjectGroupResponse group, Set<String> supportedLevels) {
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

    public Set<String> getSupportedLevels() {
        return supportedLevels;
    }
}
