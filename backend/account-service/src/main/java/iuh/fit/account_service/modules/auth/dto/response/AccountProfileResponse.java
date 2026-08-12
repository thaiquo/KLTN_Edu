package iuh.fit.account_service.modules.auth.dto.response;

public record AccountProfileResponse(
    String fullName,
    String phone,
    String avatarUrl
) {
}