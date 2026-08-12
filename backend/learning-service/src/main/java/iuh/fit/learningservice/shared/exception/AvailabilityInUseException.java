package iuh.fit.learningservice.shared.exception;

public class AvailabilityInUseException extends RuntimeException {

    public AvailabilityInUseException() {
        super("Cannot update availability because it is used by an active class");
    }
}
