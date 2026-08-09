package iuh.fit.authservice.modules.auth.dto.response;

public record AuthResponseBody(
    AccountResponse user,
    String message
) {
}