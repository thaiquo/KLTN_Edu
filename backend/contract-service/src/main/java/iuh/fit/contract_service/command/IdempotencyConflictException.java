package iuh.fit.contract_service.command;

public class IdempotencyConflictException extends IllegalStateException {
    public IdempotencyConflictException(String idempotencyKey) {
        super("Idempotency key already belongs to a different transaction intent: " + idempotencyKey);
    }
}
