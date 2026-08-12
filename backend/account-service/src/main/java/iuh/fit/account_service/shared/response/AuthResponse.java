package iuh.fit.account_service.shared.response;

public record AuthResponse<T>(T user, String message) {
}