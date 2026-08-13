package iuh.fit.account_service.exception;

import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handlesValidationErrorsWithFieldDetails() throws Exception {
        Method method = SampleController.class.getDeclaredMethod("handle", SampleRequest.class);
        MethodParameter parameter = new MethodParameter(method, 0);
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(
                new SampleRequest(),
                "request"
        );
        bindingResult.addError(new FieldError("request", "email", "Email is invalid"));

        MethodArgumentNotValidException exception =
                new MethodArgumentNotValidException(parameter, bindingResult);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/register");

        var response = handler.handleValidationException(exception, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getPath()).isEqualTo("/api/auth/register");
        assertThat(response.getBody().getMessage()).isEqualTo("Validation failed");
        assertThat(response.getBody().getValidationErrors())
                .extracting(ValidationError::getField)
                .containsExactly("email");
    }

    @Test
    void mapsNotFoundTo404() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/99");

        var response = handler.handleNotFound(
                new ResourceNotFoundException("User not found"),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).isEqualTo("User not found");
        assertThat(response.getBody().getPath()).isEqualTo("/api/users/99");
    }

    @Test
    void mapsConflictTo409() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/register");

        var response = handler.handleConflict(
                new ConflictException("Email already exists"),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).isEqualTo("Email already exists");
    }

    @Test
    void unexpectedErrorsDoNotLeakInternalMessage() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/test");

        var response = handler.handleUnexpected(
                new RuntimeException("database password is secret"),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).isEqualTo("Unexpected server error");
    }

    @Test
    void storageErrorsUseSafeSemanticMessage() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tutor-applications/me/documents");

        var response = handler.handleStorage(
                new StorageException("S3 put failed"),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).isEqualTo("Storage operation failed");
        assertThat(response.getBody().getPath()).isEqualTo("/api/tutor-applications/me/documents");
    }

    private static class SampleController {

        @SuppressWarnings("unused")
        void handle(SampleRequest request) {
        }
    }

    private static class SampleRequest {
    }
}
