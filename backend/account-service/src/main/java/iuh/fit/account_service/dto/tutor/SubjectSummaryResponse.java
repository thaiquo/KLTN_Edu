package iuh.fit.account_service.dto.tutor;

public class SubjectSummaryResponse {

    private Long id;
    private String name;

    public SubjectSummaryResponse(Long id, String name) {
        this.id = id;
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}
