package iuh.fit.account_service.modules.tutor.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TutorApprovalRequest(
    @NotBlank @Size(max = 1000) String note
) {}
