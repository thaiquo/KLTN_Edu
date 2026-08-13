package iuh.fit.account_service.dto.staff;

import jakarta.validation.constraints.Size;

public class StaffReviewNoteRequest {

    @Size(max = 1000, message = "Review note must not exceed 1000 characters")
    private String note;

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
