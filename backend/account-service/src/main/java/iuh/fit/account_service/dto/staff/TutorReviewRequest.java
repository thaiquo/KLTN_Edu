package iuh.fit.account_service.dto.staff;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class TutorReviewRequest {

    @NotBlank(message = "Reject reason is required")
    @Size(max = 1000, message = "Reject reason must not exceed 1000 characters")
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
