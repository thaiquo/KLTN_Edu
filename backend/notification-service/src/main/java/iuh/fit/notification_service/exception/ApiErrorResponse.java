package iuh.fit.notification_service.exception;

import java.time.LocalDateTime;

public record ApiErrorResponse(
        int status,
        String message,
        LocalDateTime timestamp
) {
    public ApiErrorResponse(int status, String message) {
        this(status, message, LocalDateTime.now());
    }
}
