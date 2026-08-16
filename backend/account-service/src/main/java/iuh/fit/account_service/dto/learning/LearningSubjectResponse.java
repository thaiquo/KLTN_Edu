package iuh.fit.account_service.dto.learning;

import java.util.Set;

public class LearningSubjectResponse {
    private Long id;
    private String name;
    private CategoryResponse category;
    private GroupResponse group;
    private Set<String> supportedLevels;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public CategoryResponse getCategory() { return category; }
    public void setCategory(CategoryResponse category) { this.category = category; }
    public GroupResponse getGroup() { return group; }
    public void setGroup(GroupResponse group) { this.group = group; }
    public Set<String> getSupportedLevels() { return supportedLevels; }
    public void setSupportedLevels(Set<String> supportedLevels) { this.supportedLevels = supportedLevels; }

    public static class CategoryResponse {
        private Long id;
        private String name;
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }

    public static class GroupResponse {
        private Long id;
        private String name;
        private CategoryResponse category;
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public CategoryResponse getCategory() { return category; }
        public void setCategory(CategoryResponse category) { this.category = category; }
    }
}
