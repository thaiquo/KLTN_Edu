package iuh.fit.account_service.modules.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    String email
) {
}