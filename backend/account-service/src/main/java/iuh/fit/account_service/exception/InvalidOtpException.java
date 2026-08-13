package iuh.fit.account_service.exception;

public class InvalidOtpException extends BadRequestException {

    public InvalidOtpException(String message) {
        super(message);
    }
}
