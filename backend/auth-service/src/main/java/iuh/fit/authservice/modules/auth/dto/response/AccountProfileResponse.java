package iuh.fit.authservice.modules.auth.dto.response;

public record AccountProfileResponse(
    String fullName,
    String phone,
    String avatarUrl
) {
}