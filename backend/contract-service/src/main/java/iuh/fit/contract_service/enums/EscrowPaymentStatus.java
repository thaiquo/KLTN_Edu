package iuh.fit.contract_service.enums;

public enum EscrowPaymentStatus {
    NOT_STARTED,
    APPROVAL_PENDING,
    DEPOSIT_PENDING,
    CONFIRMING,
    LOCKED,
    PARTIALLY_RELEASED,
    SETTLED,
    REFUNDED,
    FAILED_RETRYABLE,
    EXPIRED
}
