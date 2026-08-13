package iuh.fit.account_service.dto.staff;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class StaffRejectTutorApplicationRequest {

    @NotBlank(message = "Rejection reason is required")
    @Size(max = 1000, message = "Rejection reason must not exceed 1000 characters")
    private String reason;

    @Size(max = 1000, message = "Review note must not exceed 1000 characters")
    private String note;

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
