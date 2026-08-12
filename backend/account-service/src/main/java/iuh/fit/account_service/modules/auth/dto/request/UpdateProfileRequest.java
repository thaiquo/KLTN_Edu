package iuh.fit.account_service.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 120, message = "Full name must be between 2 and 120 characters")
    String fullName,

    @Size(min = 8, max = 30, message = "Phone must be between 8 and 30 characters")
    String phone,

    @Size(max = 1024, message = "Avatar URL must not exceed 1024 characters")
    String avatarUrl
) {
}