package iuh.fit.account_service.dto.subjectsuggestion;

import jakarta.validation.constraints.NotNull;

public class MapSubjectSuggestionRequest {

    @NotNull(message = "Subject is required")
    private Long subjectId;

    private String note;

    public Long getSubjectId() { return subjectId; }
    public void setSubjectId(Long subjectId) { this.subjectId = subjectId; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
