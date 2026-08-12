package iuh.fit.account_service.modules.auth.dto.response;

public record TokenPairResponse(
    String accessToken,
    String refreshToken
) {
}