package iuh.fit.account_service.exception;

import java.time.LocalDateTime;
import java.util.List;

public class ApiErrorResponse {

    private LocalDateTime timestamp;
    private int status;
    private String error;
    private String code;
    private String message;
    private String path;
    private List<ValidationError> validationErrors;
    private List<String> missingItems;

    public ApiErrorResponse(
            LocalDateTime timestamp,
            int status,
            String error,
            String message,
            String path,
            List<ValidationError> validationErrors
    ) {
        this(timestamp, status, error, null, message, path, validationErrors, null);
    }

    public ApiErrorResponse(
            LocalDateTime timestamp,
            int status,
            String error,
            String message,
            String path,
            List<ValidationError> validationErrors,
            List<String> missingItems
    ) {
        this(timestamp, status, error, null, message, path, validationErrors, missingItems);
    }

    public ApiErrorResponse(
            LocalDateTime timestamp,
            int status,
            String error,
            String code,
            String message,
            String path,
            List<ValidationError> validationErrors,
            List<String> missingItems
    ) {
        this.timestamp = timestamp;
        this.status = status;
        this.error = error;
        this.code = code;
        this.message = message;
        this.path = path;
        this.validationErrors = validationErrors;
        this.missingItems = missingItems;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public int getStatus() {
        return status;
    }

    public String getError() {
        return error;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public String getPath() {
        return path;
    }

    public List<ValidationError> getValidationErrors() {
        return validationErrors;
    }

    public List<String> getMissingItems() {
        return missingItems;
    }
}
