package iuh.fit.ai_service.exception;

import iuh.fit.ai_service.service.CatalogGroundingService.CatalogGroundingUnavailableException;
import iuh.fit.ai_service.service.CatalogGroundingService.LocationGroundingUnavailableException;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;

import java.util.List;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::formatFieldError)
                .toList();
        return ResponseEntity.badRequest().body(new ErrorResponse("Validation failed", errors));
    }

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<ErrorResponse> handleRestClient(RestClientException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse("Unable to retrieve tutor candidates", List.of(exception.getMessage())));
    }

    @ExceptionHandler(GeminiUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleGeminiUnavailable(GeminiUnavailableException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse(
                        "Gemini requirement analysis is temporarily unavailable",
                        List.of(safeMessage(exception.getMessage()))
                ));
    }

    @ExceptionHandler(CatalogGroundingUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleCatalogUnavailable(CatalogGroundingUnavailableException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse(
                        "Learning catalog grounding is temporarily unavailable",
                        List.of(safeMessage(exception.getMessage()))
                ));
    }

    @ExceptionHandler(LocationGroundingUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleLocationUnavailable(LocationGroundingUnavailableException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse(
                        "Location grounding is temporarily unavailable",
                        List.of(safeMessage(exception.getMessage()))
                ));
    }

    private String formatFieldError(FieldError error) {
        return error.getField() + ": " + error.getDefaultMessage();
    }

    public record ErrorResponse(String message, List<String> errors) {
    }

    private String safeMessage(String message) {
        if (message == null || message.isBlank()) {
            return "Provider request failed";
        }
        return message.replaceAll("(?i)(key|token|secret)=[^\\s]+", "$1=<redacted>");
    }
}
