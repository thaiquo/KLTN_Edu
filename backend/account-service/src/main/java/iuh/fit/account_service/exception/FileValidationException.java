package iuh.fit.account_service.exception;

public class FileValidationException extends BadRequestException {

    public FileValidationException(String message) {
        super(message);
    }
}
