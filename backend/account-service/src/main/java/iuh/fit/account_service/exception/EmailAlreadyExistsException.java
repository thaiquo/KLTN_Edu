package iuh.fit.account_service.exception;

public class EmailAlreadyExistsException extends ConflictException {

    public EmailAlreadyExistsException(String message) {
        super(message);
    }
}
