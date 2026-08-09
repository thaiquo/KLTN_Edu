package iuh.fit.authservice.modules.auth.dto.response;

public record TokenPairResponse(
    String accessToken,
    String refreshToken
) {
}