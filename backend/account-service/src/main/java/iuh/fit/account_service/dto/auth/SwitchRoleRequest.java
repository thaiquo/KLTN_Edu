package iuh.fit.account_service.dto.auth;

import jakarta.validation.constraints.NotBlank;

public class SwitchRoleRequest {

    @NotBlank(message = "Target role is required")
    private String targetRole;

    public String getTargetRole() {
        return targetRole;
    }

    public void setTargetRole(String targetRole) {
        this.targetRole = targetRole;
    }
}
