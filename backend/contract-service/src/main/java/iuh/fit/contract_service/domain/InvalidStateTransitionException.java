package iuh.fit.contract_service.domain;

public class InvalidStateTransitionException extends IllegalStateException {
    public InvalidStateTransitionException(Enum<?> current, Enum<?> target) {
        super("Invalid state transition from " + current + " to " + target);
    }
}
