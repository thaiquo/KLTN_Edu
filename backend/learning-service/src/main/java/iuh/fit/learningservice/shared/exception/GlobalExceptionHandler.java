package iuh.fit.learningservice.shared.exception;

import iuh.fit.learningservice.shared.response.ErrorResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AvailabilityInUseException.class)
    public ResponseEntity<ErrorResponse> handleAvailabilityInUse(AvailabilityInUseException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("AVAILABILITY_IN_USE", exception.getMessage()));
    }

    @ExceptionHandler(InvalidAvailabilityException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAvailability(InvalidAvailabilityException exception) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("INVALID_AVAILABILITY", exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(error -> error.getField() + " " + error.getDefaultMessage())
            .orElse("Request validation failed");
        return ResponseEntity.badRequest().body(new ErrorResponse("VALIDATION_ERROR", message));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException exception) {
        return ResponseEntity.status(exception.getStatus())
            .body(new ErrorResponse(exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse(
            "INVALID_AVAILABILITY", "Thời gian kết thúc phải sau thời gian bắt đầu và không được trùng lịch"
        ));
    }
}
