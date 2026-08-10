package iuh.fit.account_service.dto.tutor;

public class SubjectResponse {

    private Long id;
    private String name;
    private SubjectCategoryResponse category;

    public SubjectResponse(Long id, String name, SubjectCategoryResponse category) {
        this.id = id;
        this.name = name;
        this.category = category;
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
}
