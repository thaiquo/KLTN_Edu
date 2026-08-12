package iuh.fit.account_service.shared.exception;

public class ConflictException extends BusinessException {

    public ConflictException(String message) {
        super(message);
    }
}