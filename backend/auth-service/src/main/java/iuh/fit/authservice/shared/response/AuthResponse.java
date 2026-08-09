package iuh.fit.authservice.shared.response;

public record AuthResponse<T>(T user, String message) {
}