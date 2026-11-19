package iuh.fit.account_service.exception;

import org.springframework.http.HttpStatus;

public class LoginProtectionException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Long retryAfterSeconds;

    public LoginProtectionException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    public LoginProtectionException(HttpStatus status, String code, String message, Long retryAfterSeconds) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
    public Long getRetryAfterSeconds() { return retryAfterSeconds; }

    public static LoginProtectionException challengeRequired() {
        return new LoginProtectionException(HttpStatus.UNAUTHORIZED, "LOGIN_CHALLENGE_REQUIRED",
                "Vui lòng xác minh để thử đăng nhập lại.");
    }

    public static LoginProtectionException unavailable() {
        return new LoginProtectionException(HttpStatus.SERVICE_UNAVAILABLE, "LOGIN_PROTECTION_UNAVAILABLE",
                "Tạm thời không thể xác minh đăng nhập. Vui lòng thử lại sau.");
    }

    public static LoginProtectionException attemptInProgress(long retryAfterSeconds) {
        return new LoginProtectionException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_ATTEMPT_IN_PROGRESS",
                "Một yêu cầu đăng nhập khác đang được xử lý.", retryAfterSeconds);
    }
}
