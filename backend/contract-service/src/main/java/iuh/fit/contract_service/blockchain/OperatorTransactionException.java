package iuh.fit.contract_service.blockchain;

public class OperatorTransactionException extends RuntimeException {
    public OperatorTransactionException(String message) {
        super(message);
    }

    public OperatorTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
